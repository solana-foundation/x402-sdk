import http from "node:http";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402HTTPResourceServer, type HTTPAdapter } from "@x402/core/http";
import { x402ResourceServer, type FacilitatorClient } from "@x402/core/server";
import { x402Facilitator } from "@x402/core/facilitator";
import type { SupportedResponse } from "@x402/core/types";
import { registerExactSvmScheme as registerExactFacilitatorScheme } from "@solana/x402/facilitator/exact";
import { toFacilitatorSvmSigner } from "@solana/x402";
import { registerExactSvmScheme as registerExactServerScheme } from "@solana/x402/server/exact";
import { interopScenario, localSolanaInteropCapabilities } from "../../contracts";
import { fixtureSettlementHeader, readInteropEnvironment } from "./shared";

export type InteropAcceptEntry = {
  scheme: string;
  network: string;
  payTo: string;
  price: { amount: string; asset: string; extra: { decimals: number; tokenProgram: string } };
};

const TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ADDRESS = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// Mints that ship as Token-2022. USDC is canonical SPL Token classic;
// PYUSD/USDG/CASH are Token-2022 on every network. Mirrors
// STABLECOIN_TOKEN_PROGRAMS at
// typescript/packages/x402/src/protocol/schemes/exact/constants.ts:113.
const TOKEN_2022_MINTS: ReadonlySet<string> = new Set([
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD mainnet
  "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM", // PYUSD devnet/testnet
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", // USDG mainnet
  "4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7", // USDG devnet/testnet
  "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", // CASH mainnet
]);

function tokenProgramForMint(mint: string): string {
  return TOKEN_2022_MINTS.has(mint) ? TOKEN_2022_PROGRAM_ADDRESS : TOKEN_PROGRAM_ADDRESS;
}

/**
 * Build the `accepts` list advertised by the TypeScript interop server.
 *
 * Every accept entry must carry both `extra.decimals` (so foreign clients
 * scale the SPL transfer correctly) and `extra.tokenProgram` (so they
 * target SPL Token classic vs Token-2022 correctly). The upstream
 * string-price helper resolves `$0.001` to USDC + 6 decimals but emits
 * `extra: {}`; we expand every entry into the object form so the wire
 * shape stays canonical.
 *
 * Extracted from `main` so the wire shape can be asserted in unit tests
 * without spawning the HTTP server.
 */
export function buildInteropAcceptsList(options: {
  network: string;
  payTo: string;
  extraOfferedMints: readonly string[];
}): InteropAcceptEntry[] {
  return [
    {
      scheme: interopScenario.scheme,
      network: options.network,
      payTo: options.payTo,
      price: {
        amount: "1000",
        asset: interopScenario.asset,
        extra: { decimals: 6, tokenProgram: tokenProgramForMint(interopScenario.asset) },
      },
    },
    ...options.extraOfferedMints.map(mint => ({
      scheme: interopScenario.scheme,
      network: options.network,
      payTo: options.payTo,
      price: {
        amount: "1000",
        asset: mint,
        extra: { decimals: 6, tokenProgram: tokenProgramForMint(mint) },
      },
    })),
  ];
}

class NodeAdapter implements HTTPAdapter {
  constructor(
    private readonly request: http.IncomingMessage,
    private readonly url: URL,
  ) {}

  getHeader(name: string): string | undefined {
    const target = name.toLowerCase();
    const entry = Object.entries(this.request.headers).find(([key]) => key.toLowerCase() === target);
    if (!entry) {
      return undefined;
    }

    const value = entry[1];
    return Array.isArray(value) ? value[0] : value;
  }

  getMethod(): string {
    return this.request.method ?? "GET";
  }

  getPath(): string {
    return this.url.pathname;
  }

  getUrl(): string {
    return this.url.toString();
  }

  getAcceptHeader(): string {
    return this.getHeader("accept") ?? "";
  }

  getUserAgent(): string {
    return this.getHeader("user-agent") ?? "";
  }
}

class FacilitatorClientAdapter implements FacilitatorClient {
  constructor(private readonly facilitator: x402Facilitator) {}

  async getSupported(): Promise<SupportedResponse> {
    return this.facilitator.getSupported() as SupportedResponse;
  }

  async verify(paymentPayload: Parameters<x402Facilitator["verify"]>[0], paymentRequirements: Parameters<x402Facilitator["verify"]>[1]) {
    return await this.facilitator.verify(paymentPayload, paymentRequirements);
  }

  async settle(paymentPayload: Parameters<x402Facilitator["settle"]>[0], paymentRequirements: Parameters<x402Facilitator["settle"]>[1]) {
    return await this.facilitator.settle(paymentPayload, paymentRequirements);
  }
}

async function main() {
  const environment = readInteropEnvironment();
  const signer = await createKeyPairSignerFromBytes(environment.facilitatorSecretKey);

  const facilitator = registerExactFacilitatorScheme(new x402Facilitator(), {
    signer: toFacilitatorSvmSigner(signer, { defaultRpcUrl: environment.rpcUrl }),
    networks: environment.network as never,
  });

  const resourceServer = registerExactServerScheme(
    new x402ResourceServer(new FacilitatorClientAdapter(facilitator)),
    {
    networks: [environment.network as never],
    },
  );
  await resourceServer.initialize();

  // Multi-currency: when `X402_INTEROP_EXTRA_OFFERED_MINTS` is set, the
  // server advertises additional payment options alongside the primary
  // currency. Canonical x402's `accepts: PaymentOption[]` shape handles
  // this directly — the resource server builds a requirement for each.
  const extraOfferedMints = (process.env.X402_INTEROP_EXTRA_OFFERED_MINTS ?? "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
  const acceptsList = buildInteropAcceptsList({
    network: environment.network,
    payTo: environment.payTo,
    extraOfferedMints,
  }) as unknown as Array<{
    scheme: string;
    network: never;
    payTo: string;
    price: { amount: string; asset: string; extra: { decimals: number } };
  }>;

  const httpServer = new x402HTTPResourceServer(resourceServer, {
    [`GET ${interopScenario.resourcePath}`]: {
      accepts: acceptsList.length === 1 ? acceptsList[0] : acceptsList,
      description: "Surfpool-backed protected content",
      mimeType: "application/json",
      unpaidResponseBody: async () => ({
        contentType: "application/json",
        body: { error: "payment_required" },
      }),
    },
  });
  await httpServer.initialize();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      const adapter = new NodeAdapter(request, url);
      const processResult = await httpServer.processHTTPRequest({
        adapter,
        path: url.pathname,
        method: request.method ?? "GET",
      });

      if (processResult.type === "no-payment-required") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, paid: false }));
        return;
      }

      if (processResult.type === "payment-error") {
        response.writeHead(processResult.response.status, processResult.response.headers);
        response.end(JSON.stringify(processResult.response.body ?? {}));
        return;
      }

      const settlement = await httpServer.processSettlement(
        processResult.paymentPayload,
        processResult.paymentRequirements,
        processResult.declaredExtensions,
      );

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };

      if (settlement.success) {
        Object.assign(headers, settlement.headers);
        headers[fixtureSettlementHeader] = String(settlement.transaction);
      }

      response.writeHead(settlement.success ? 200 : 500, headers);
      response.end(
        JSON.stringify({
          ok: settlement.success,
          paid: settlement.success,
          settlement,
        }),
      );
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind TypeScript interop server");
    }

    console.log(
      JSON.stringify({
        type: "ready",
        implementation: "typescript",
        role: "server",
        port: address.port,
        capabilities: localSolanaInteropCapabilities,
      }),
    );
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Only spawn the HTTP server when this module is executed directly (i.e.
// by the interop adapter command). Avoid side effects when imported by
// unit tests that exercise `buildInteropAcceptsList` etc.
const invokedAsScript = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return new URL(`file://${entry}`).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  void main();
}
