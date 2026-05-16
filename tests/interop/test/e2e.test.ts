import net from "node:net";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSolanaRpc } from "@solana/kit";
import { Surfnet } from "surfpool-sdk";
import { interopScenario } from "../src/contracts";
import { clientImplementations, serverImplementations } from "../src/implementations";
import { runClient, startServer, stopServer } from "../src/process";

type RunningServer = Awaited<ReturnType<typeof startServer>>;

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_ACCOUNT_SIZE = 82;

const runningServers: RunningServer[] = [];

let surfnet: Surfnet | undefined;
let interopEnv: Record<string, string> | undefined;

async function canBindLocalSocket(): Promise<boolean> {
  return await new Promise<boolean>(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(0, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function getTokenBalance(
  surfnet: Surfnet,
  owner: string,
  mint: string,
  tokenProgram?: string,
): Promise<bigint> {
  const rpc = createSolanaRpc(surfnet.rpcUrl);
  const ata = surfnet.getAta(owner, mint, tokenProgram);
  const response = await rpc.getTokenAccountBalance(ata as never).send();
  return BigInt(response.value.amount);
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
const activeClients = clientImplementations.filter(implementation => implementation.enabled);
const hasEnabledMatrix = activeServers.length > 0 && activeClients.length > 0;
const matrixDescribe = hasEnabledMatrix ? describe : describe.skip;

function implementationIds(implementations: typeof serverImplementations): string {
  return implementations.map(implementation => implementation.id).join(", ");
}

beforeAll(async () => {
  if (!socketSupport) {
    return;
  }

  surfnet = Surfnet.start();

  const client = Surfnet.newKeypair();
  const payTo = Surfnet.newKeypair();

  surfnet.setAccount(interopScenario.asset, 1_461_600, createSplMintAccountData(6), TOKEN_PROGRAM);
  surfnet.fundToken(client.publicKey, interopScenario.asset, 100_000);
  surfnet.fundToken(payTo.publicKey, interopScenario.asset, 1);

  interopEnv = {
    X402_INTEROP_RPC_URL: surfnet.rpcUrl,
    X402_INTEROP_NETWORK: interopScenario.network,
    X402_INTEROP_MINT: interopScenario.asset,
    X402_INTEROP_PRICE: interopScenario.price,
    X402_INTEROP_PAY_TO: payTo.publicKey,
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

describe("x402 interop", () => {
  const socketAwareIt = socketSupport ? it : it.skip;

  it("has at least one enabled client and server implementation", () => {
    expect(
      activeClients.length,
      `No x402 interop clients enabled. Set X402_INTEROP_CLIENTS to one of: ${implementationIds(clientImplementations)}`,
    ).toBeGreaterThan(0);
    expect(
      activeServers.length,
      `No x402 interop servers enabled. Set X402_INTEROP_SERVERS to one of: ${implementationIds(serverImplementations)}`,
    ).toBeGreaterThan(0);
  });

  for (const serverImplementation of activeServers) {
    for (const clientImplementation of activeClients) {
      socketAwareIt(`${clientImplementation.id} client pays ${serverImplementation.id} server`, async () => {
        if (!surfnet || !interopEnv) {
          throw new Error("Surfpool interop environment was not initialized");
        }

        const initialBalance = await getTokenBalance(
          surfnet,
          interopEnv.X402_INTEROP_PAY_TO,
          interopEnv.X402_INTEROP_MINT,
        );

        const server = await startServer(serverImplementation, interopEnv);
        runningServers.push(server);

        const targetUrl = `http://127.0.0.1:${server.ready.port}${interopScenario.resourcePath}`;
        const result = await runClient(clientImplementation, targetUrl, interopEnv);

        const finalBalance = await getTokenBalance(
          surfnet,
          interopEnv.X402_INTEROP_PAY_TO,
          interopEnv.X402_INTEROP_MINT,
        );

        expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
        expect(result.status).toBe(200);
        expect(result.responseBody).toMatchObject({
          ok: true,
          paid: true,
        });
        expect(typeof result.settlement).toBe("string");
        expect(result.settlement).not.toHaveLength(0);
        expect(finalBalance - initialBalance).toBe(1_000n);
      });
    }
  }
});

// ── Multi-currency vectors ────────────────────────────────────────────────
//
// The server advertises both USDC (primary, via X402_INTEROP_MINT) and
// PYUSD (additional, via X402_INTEROP_EXTRA_OFFERED_MINTS). The client
// picks one via X402_INTEROP_PREFER_CURRENCIES (priority-ordered). The
// canonical x402 TS resource server already supports multi-currency via
// `accepts: PaymentOption[]` and the canonical client supports a custom
// `paymentRequirementsSelector` — both adapters honor the same env vars.

const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const PYUSD_DEVNET_MINT = "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM";

matrixDescribe("x402 interop multi-currency", () => {
  const socketAwareIt = socketSupport ? it : it.skip;

  async function setupPyusdMint(): Promise<string> {
    if (!surfnet || !interopEnv) {
      throw new Error("Surfpool interop environment was not initialized");
    }
    // PYUSD on devnet uses Token-2022. The 4th `fundToken` arg pins the
    // owning token program for the ATA — without it Surfnet defaults to
    // legacy SPL Token, and `transferChecked` fails with InvalidAccountData.
    surfnet.setAccount(
      PYUSD_DEVNET_MINT,
      1_461_600,
      createSplMintAccountData(6),
      TOKEN_2022_PROGRAM,
    );
    surfnet.fundToken(
      interopEnv.X402_INTEROP_PAY_TO,
      PYUSD_DEVNET_MINT,
      1,
      TOKEN_2022_PROGRAM,
    );
    const secretBytes = new Uint8Array(JSON.parse(interopEnv.X402_INTEROP_CLIENT_SECRET_KEY));
    const { getAddressFromPublicKey, createKeyPairFromBytes } = await import("@solana/kit");
    const kp = await createKeyPairFromBytes(secretBytes);
    const clientAddress = await getAddressFromPublicKey(kp.publicKey);
    surfnet.fundToken(clientAddress, PYUSD_DEVNET_MINT, 100_000, TOKEN_2022_PROGRAM);
    return clientAddress;
  }

  for (const serverImplementation of activeServers) {
    for (const clientImplementation of activeClients) {
      socketAwareIt(
        `${clientImplementation.id} client picks PYUSD from ${serverImplementation.id} server offering USDC + PYUSD`,
        async () => {
          if (!surfnet || !interopEnv) {
            throw new Error("Surfpool interop environment was not initialized");
          }
          await setupPyusdMint();

          const initialPyusdBalance = await getTokenBalance(
            surfnet,
            interopEnv.X402_INTEROP_PAY_TO,
            PYUSD_DEVNET_MINT,
            TOKEN_2022_PROGRAM,
          );

          const multiEnv = {
            ...interopEnv,
            X402_INTEROP_EXTRA_OFFERED_MINTS: PYUSD_DEVNET_MINT,
          };
          const server = await startServer(serverImplementation, multiEnv);
          runningServers.push(server);

          const targetUrl = `http://127.0.0.1:${server.ready.port}${interopScenario.resourcePath}`;
          const result = await runClient(clientImplementation, targetUrl, {
            ...multiEnv,
            X402_INTEROP_PREFER_CURRENCIES: "PYUSD,USDC",
          });

          const finalPyusdBalance = await getTokenBalance(
            surfnet,
            interopEnv.X402_INTEROP_PAY_TO,
            PYUSD_DEVNET_MINT,
            TOKEN_2022_PROGRAM,
          );

          expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
          expect(result.status).toBe(200);
          expect(finalPyusdBalance - initialPyusdBalance).toBe(1_000n);
        },
        20_000,
      );

      socketAwareIt(
        `${clientImplementation.id} client falls back to USDC when PYUSD is not in its preference list (${serverImplementation.id} server)`,
        async () => {
          if (!surfnet || !interopEnv) {
            throw new Error("Surfpool interop environment was not initialized");
          }

          const initialUsdcBalance = await getTokenBalance(
            surfnet,
            interopEnv.X402_INTEROP_PAY_TO,
            interopEnv.X402_INTEROP_MINT,
          );

          const multiEnv = {
            ...interopEnv,
            X402_INTEROP_EXTRA_OFFERED_MINTS: PYUSD_DEVNET_MINT,
          };
          const server = await startServer(serverImplementation, multiEnv);
          runningServers.push(server);

          const targetUrl = `http://127.0.0.1:${server.ready.port}${interopScenario.resourcePath}`;
          const result = await runClient(clientImplementation, targetUrl, {
            ...multiEnv,
            X402_INTEROP_PREFER_CURRENCIES: "USDC",
          });

          const finalUsdcBalance = await getTokenBalance(
            surfnet,
            interopEnv.X402_INTEROP_PAY_TO,
            interopEnv.X402_INTEROP_MINT,
          );

          expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
          expect(finalUsdcBalance - initialUsdcBalance).toBe(1_000n);
        },
        20_000,
      );
    }
  }
});
