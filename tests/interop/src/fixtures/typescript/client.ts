import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequirements } from "@x402/core/types";
import { registerExactSvmScheme } from "@solana/x402/client/exact";
import { readInteropEnvironment, fixtureSettlementHeader } from "./shared";

// Resolve a known stablecoin symbol or mint address to its canonical mint
// for a given network. Mirrors `resolve_stablecoin_mint` in the Rust kit.
const STABLECOIN_MINTS: Record<string, Record<string, string>> = {
  USDC: {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  },
  PYUSD: {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM",
  },
  USDG: {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7",
  },
  USDT: {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
};

function resolveMint(currency: string, network: string): string {
  const upper = currency.toUpperCase();
  const byNetwork = STABLECOIN_MINTS[upper];
  if (byNetwork) {
    return byNetwork[network] ?? byNetwork["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"] ?? currency;
  }
  return currency;
}

/**
 * Selector that picks the first offer matching the highest-priority
 * currency in `preferred`. Currencies can be symbols or mint addresses.
 * Returns `accepts[0]` (the canonical default) when no preference is
 * configured or no offer matches.
 */
function makeCurrencySelector(preferred: string[], network: string) {
  return (_x402Version: number, accepts: PaymentRequirements[]): PaymentRequirements => {
    if (preferred.length === 0) {
      return accepts[0];
    }
    for (const wanted of preferred) {
      const wantedMint = resolveMint(wanted, network);
      const match = accepts.find(req => {
        const offered = req.asset ?? "";
        return resolveMint(offered, network) === wantedMint;
      });
      if (match) {
        return match;
      }
    }
    // No match: fall through to the canonical default (server's first
    // offer). The Rust client returns None in this case; here we follow
    // the canonical's accepts[0] convention so the harness still shows a
    // meaningful error if the route happens to be incompatible.
    return accepts[0];
  };
}

async function main() {
  const targetUrl = process.env.X402_INTEROP_TARGET_URL;
  if (!targetUrl) {
    throw new Error("X402_INTEROP_TARGET_URL is required");
  }

  const environment = readInteropEnvironment();
  const signer = await createKeyPairSignerFromBytes(environment.clientSecretKey);

  const preferredCurrencies = (process.env.X402_INTEROP_PREFER_CURRENCIES ?? "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
  const selector = preferredCurrencies.length > 0
    ? makeCurrencySelector(preferredCurrencies, environment.network)
    : undefined;

  const client = new x402HTTPClient(
    registerExactSvmScheme(new x402Client(selector), {
      signer,
      rpcUrl: environment.rpcUrl,
      networks: [environment.network as never],
    }),
  );

  const firstResponse = await fetch(targetUrl);
  const paymentRequired = client.getPaymentRequiredResponse(name => firstResponse.headers.get(name));
  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = client.encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await fetch(targetUrl, {
    headers: paymentHeaders,
  });

  const rawBody = await paidResponse.text();
  let responseBody: unknown = rawBody;
  try {
    responseBody = JSON.parse(rawBody);
  } catch {
    // Keep raw string when the response body is not JSON.
  }

  console.log(
    JSON.stringify({
      type: "result",
      implementation: "typescript",
      role: "client",
      ok: paidResponse.ok,
      status: paidResponse.status,
      responseHeaders: Object.fromEntries(paidResponse.headers.entries()),
      responseBody,
      settlement: paidResponse.headers.get(fixtureSettlementHeader),
    }),
  );
}

void main();
