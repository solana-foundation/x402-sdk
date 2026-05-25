import net from "node:net";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Surfnet } from "surfpool-sdk";
import { interopScenario } from "../src/contracts";
import { clientImplementations, serverImplementations } from "../src/implementations";
import { runClient, startServer, stopServer } from "../src/process";

// Cross-server portability and idempotent resubmit scenarios per MPP M1
// closure §19.6. These tests need at least two active server adapters
// (cross-server) or any server adapter (idempotent), drive them with the
// TypeScript reference client (which is the only client today that exposes
// the X402_INTEROP_REUSE_CREDENTIAL escape hatch), and assert that the
// canonical L4/L6 reject codes fire.
//
// Activation: X402_INTEROP_CROSS_SERVER=1. Default `pnpm test` skips them
// because each case spins up two real Surfpool-backed servers and a real
// on-chain settlement before the replay attempt.

const ENABLED = process.env.X402_INTEROP_CROSS_SERVER === "1";
const suite = ENABLED ? describe : describe.skip;

type RunningServer = Awaited<ReturnType<typeof startServer>>;

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_ACCOUNT_SIZE = 82;
const CASE_TIMEOUT_MS = 240_000;

// Canonical reject reasons the spine emits when a credential is replayed
// against the wrong server (payTo / resource / network mismatch). Different
// adapters surface these differently (string error message, body field,
// or stringified enum), so we accept any token that appears in the
// canonical reference implementations. Sourced from:
//   typescript/packages/x402/src/facilitator/exact/scheme.ts (TS spine)
//   rust/src/protocol/schemes/exact/verify.rs (Rust spine)
//   rust/src/error.rs (Rust spine error enum)
const CROSS_SERVER_REJECT_TOKENS = [
  "invalid_exact_svm_payload_recipient_mismatch",
  "recipient_mismatch",
  "Destination ATA does not belong to expected recipient",
  "AtaMismatch",
  "challenge_verification_failed",
  "verification_failed",
  "unauthorized",
  // Both reference adapters' findMatchingRequirements rejects the
  // credential before it ever reaches the exact verifier because the
  // credential's `accepted` (containing serverA's payTo) does not match
  // any of serverB's offered payment options. This is the canonical
  // first-stage reject — the L4 envelope mismatch — and is semantically
  // equivalent to "wrong server / wrong challenge."
  "No matching payment requirements",
  "does not match any offered payment option",
  "payment_invalid",
];

// Canonical reject reasons for a duplicate / replay submission against
// the same server. The TS facilitator returns `duplicate_settlement`; the
// Rust spine surfaces `SignatureConsumed` / "already consumed".
const REPLAY_REJECT_TOKENS = [
  "duplicate_settlement",
  "signature_consumed",
  "SignatureConsumed",
  "already consumed",
  "already settled",
  "already been processed",
  "Transaction signature already consumed",
  // The TS spine simulates the resigned transaction before settlement.
  // When the same signed transaction is replayed, simulation fails on the
  // SPL transfer (the source ATA's nonce / balance state from the first
  // settlement is already on-chain), surfaced as transaction_simulation_failed.
  // This is the canonical TS replay-reject path today.
  "transaction_simulation_failed",
  "transaction_failed",
];

function bodyAsString(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

// The canonical TS HTTPResourceServer surfaces the reject reason inside
// the `payment-required` response header (base64-encoded JSON). The Rust
// server puts it in the response body instead. To make assertions robust
// across adapters, we decode and concatenate the header into the
// haystack before searching for canonical tokens.
function decodePaymentRequiredHeader(headers: Record<string, string>): string {
  const raw =
    headers["payment-required"] ??
    headers["Payment-Required"] ??
    headers["PAYMENT-REQUIRED"];
  if (!raw) return "";
  try {
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function findToken(haystack: string, tokens: string[]): string | undefined {
  const lower = haystack.toLowerCase();
  return tokens.find(token => lower.includes(token.toLowerCase()));
}

async function canBindLocalSocket(): Promise<boolean> {
  return await new Promise<boolean>(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(0, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function createSplMintAccountData(decimals: number): Uint8Array {
  const data = new Uint8Array(MINT_ACCOUNT_SIZE);
  const view = new DataView(data.buffer);
  view.setBigUint64(36, 0n, true);
  data[44] = decimals;
  data[45] = 1;
  return data;
}

const socketSupport = await canBindLocalSocket();
const activeServers = serverImplementations.filter(implementation => implementation.enabled);
const tsClient = clientImplementations.find(
  implementation => implementation.id === "typescript" && implementation.enabled,
);

let surfnet: Surfnet | undefined;
let interopEnvBase: Record<string, string> | undefined;

const runningServers: RunningServer[] = [];

beforeAll(async () => {
  if (!socketSupport || !ENABLED) {
    return;
  }

  surfnet = Surfnet.start();

  const client = Surfnet.newKeypair();
  surfnet.setAccount(interopScenario.asset, 1_461_600, createSplMintAccountData(6), TOKEN_PROGRAM);
  // Generous funding: each cross-server case needs the client to settle
  // against server A successfully, plus the replay attempt against server
  // B (which should never debit the client). 100_000 base units of USDC
  // ($0.10) at $0.001 per call covers tens of cases comfortably.
  surfnet.fundToken(client.publicKey, interopScenario.asset, 100_000);

  interopEnvBase = {
    X402_INTEROP_RPC_URL: surfnet.rpcUrl,
    X402_INTEROP_NETWORK: interopScenario.network,
    X402_INTEROP_MINT: interopScenario.asset,
    X402_INTEROP_PRICE: interopScenario.price,
    X402_INTEROP_CLIENT_SECRET_KEY: JSON.stringify(Array.from(client.secretKey)),
    X402_INTEROP_FACILITATOR_SECRET_KEY: JSON.stringify(Array.from(surfnet.payerSecretKey)),
  };
});

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await stopServer(server);
    }
  }
});

function freshPayToEnv(): Record<string, string> {
  if (!surfnet || !interopEnvBase) {
    throw new Error("Surfpool interop environment was not initialized");
  }
  const payTo = Surfnet.newKeypair();
  // Seed the recipient ATA so the facilitator can validate it exists when
  // building the transfer. Mirrors the e2e test setup.
  surfnet.fundToken(payTo.publicKey, interopEnvBase.X402_INTEROP_MINT, 1);
  return {
    ...interopEnvBase,
    X402_INTEROP_PAY_TO: payTo.publicKey,
  };
}

suite("x402 cross-server scenarios", () => {
  // ── Scenario 1: cross-server credential portability ─────────────────────
  //
  // Build the ordered pairs (serverA, serverB) where the two server impls
  // differ. The TypeScript reference client drives both legs: it pays
  // server A normally, captures the encoded PAYMENT-SIGNATURE header, then
  // re-submits the *same* header to server B. Server B MUST reject because
  // the credential's payTo / resource does not match its own context.
  //
  // Catches: any server that accepts an exact-SVM transaction without
  // re-verifying recipient identity against its own configured payTo. In
  // that case an attacker pays cheap server A and unlocks expensive
  // server B content for free.
  const orderedServerPairs = activeServers.flatMap(serverA =>
    activeServers
      .filter(serverB => serverB.id !== serverA.id)
      .map(serverB => ({ serverA, serverB })),
  );

  const haveCrossServer = socketSupport && tsClient && orderedServerPairs.length > 0;
  const crossServerIt = haveCrossServer ? it : it.skip;

  for (const { serverA, serverB } of orderedServerPairs) {
    crossServerIt(
      `rejects credential built for ${serverA.id} server when replayed against ${serverB.id} server`,
      async () => {
        if (!tsClient) {
          throw new Error("typescript client adapter is required for cross-server scenarios");
        }
        const envA = freshPayToEnv();
        const envB = freshPayToEnv();

        const a = await startServer(serverA, envA);
        runningServers.push(a);
        const targetUrlA = `http://127.0.0.1:${a.ready.port}${interopScenario.resourcePath}`;
        const firstResult = await runClient(tsClient, targetUrlA, envA);
        expect(
          firstResult.ok,
          `Setup leg must succeed: pay ${serverA.id}. Result=${JSON.stringify(firstResult, null, 2)}`,
        ).toBe(true);
        expect(firstResult.status).toBe(200);
        const credential = firstResult.paymentHeader;
        expect(
          credential,
          "TypeScript client must surface paymentHeader in result for replay scenarios",
        ).toBeTruthy();

        const b = await startServer(serverB, envB);
        runningServers.push(b);
        const targetUrlB = `http://127.0.0.1:${b.ready.port}${interopScenario.resourcePath}`;
        const replay = await runClient(tsClient, targetUrlB, {
          ...envB,
          X402_INTEROP_REUSE_CREDENTIAL: credential ?? "",
        });

        const evidence = JSON.stringify(
          {
            serverA: serverA.id,
            serverB: serverB.id,
            status: replay.status,
            body: replay.responseBody,
            headers: replay.responseHeaders,
          },
          null,
          2,
        );

        // The replay MUST NOT settle. If it does, the second server
        // silently accepted a credential bound to the first server's
        // payTo — that's a P1 security regression against the offending
        // server adapter. Surface the full payload in the failure so the
        // language PR owner can act on it.
        expect(replay.ok, `Replay against ${serverB.id} unexpectedly succeeded: ${evidence}`).toBe(
          false,
        );
        expect(
          replay.status,
          `Replay against ${serverB.id} returned non-error status: ${evidence}`,
        ).toBeGreaterThanOrEqual(400);
        const haystack =
          `${bodyAsString(replay.responseBody)} ${bodyAsString(replay.responseHeaders)} ` +
          decodePaymentRequiredHeader(replay.responseHeaders);
        const token = findToken(haystack, CROSS_SERVER_REJECT_TOKENS);
        expect(
          token,
          `Replay against ${serverB.id} did not surface a canonical cross-server reject reason. ` +
            `Expected one of ${CROSS_SERVER_REJECT_TOKENS.join(", ")}. Got: ${evidence}`,
        ).toBeTruthy();
      },
      CASE_TIMEOUT_MS,
    );
  }

  if (!haveCrossServer) {
    it.skip("requires two distinct server adapters and the typescript client adapter", () => {
      // No-op: documents why the suite is empty for this run.
    });
  }

  // ── Scenario 2: idempotent (replay) resubmit ────────────────────────────
  //
  // For every active server adapter: pay it once with the TS client,
  // capture the credential, then re-submit the same credential to the
  // same server. The second attempt MUST be rejected with a canonical
  // duplicate-settlement / signature-consumed reason. This catches any
  // adapter whose L4 replay-store has a per-instance race (the same
  // failure mode the Python lazy-init fix already proved).
  const haveReplay = socketSupport && tsClient && activeServers.length > 0;
  const replayIt = haveReplay ? it : it.skip;

  for (const server of activeServers) {
    replayIt(
      `${server.id} server rejects an idempotent resubmit of the same credential`,
      async () => {
        if (!tsClient) {
          throw new Error("typescript client adapter is required for replay scenarios");
        }
        const env = freshPayToEnv();
        const running = await startServer(server, env);
        runningServers.push(running);
        const targetUrl = `http://127.0.0.1:${running.ready.port}${interopScenario.resourcePath}`;

        const first = await runClient(tsClient, targetUrl, env);
        expect(
          first.ok,
          `Setup leg must succeed against ${server.id}. Result=${JSON.stringify(first, null, 2)}`,
        ).toBe(true);
        expect(first.status).toBe(200);
        const credential = first.paymentHeader;
        expect(credential).toBeTruthy();

        const second = await runClient(tsClient, targetUrl, {
          ...env,
          X402_INTEROP_REUSE_CREDENTIAL: credential ?? "",
        });

        const evidence = JSON.stringify(
          {
            server: server.id,
            status: second.status,
            body: second.responseBody,
            headers: second.responseHeaders,
          },
          null,
          2,
        );

        expect(second.ok, `Replay against ${server.id} unexpectedly succeeded: ${evidence}`).toBe(
          false,
        );
        expect(
          second.status,
          `Replay against ${server.id} returned non-error status: ${evidence}`,
        ).toBeGreaterThanOrEqual(400);
        const haystack =
          `${bodyAsString(second.responseBody)} ${bodyAsString(second.responseHeaders)} ` +
          decodePaymentRequiredHeader(second.responseHeaders);
        const token = findToken(haystack, REPLAY_REJECT_TOKENS);
        expect(
          token,
          `Replay against ${server.id} did not surface a canonical duplicate-settlement reason. ` +
            `Expected one of ${REPLAY_REJECT_TOKENS.join(", ")}. Got: ${evidence}`,
        ).toBeTruthy();
      },
      CASE_TIMEOUT_MS,
    );
  }
});
