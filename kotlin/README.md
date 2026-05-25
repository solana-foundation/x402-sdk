# x402 Kotlin client

This directory is a client-only Kotlin/JVM adapter for Solana x402 `exact`.
It is intentionally not a published package and does not add Maven Central,
Gradle publishing, Android, or multiplatform packaging.

## Current scope

- Parse x402 v2 `PAYMENT-REQUIRED` header envelopes.
- Parse x402 v2 JSON response body envelopes.
- Select a Solana `exact` requirement by CAIP-2 network.
- Prefer stablecoin offers by symbol or mint address for USDC, PYUSD, USDG,
  USDT, and CASH.
- Validate the selected Solana exact requirement before signing:
  `payTo`, `extra.feePayer`, unsigned integer `amount`, and SPL memo byte
  limits.
- Build the canonical x402 v2 `PAYMENT-SIGNATURE` envelope with a production
  JVM Solana transaction builder and injected signer.
- Expose a disabled interop client command for harness registration.

## Client signing boundary

The core Kotlin adapter intentionally uses injected interfaces instead of
depending on Android Mobile Wallet Adapter:

- `DefaultSolanaExactTransactionBuilder` owns Solana transaction construction.
- `SolanaTransactionSigner` owns wallet/key signing.
- `ExactPaymentClient` validates the selected requirement, calls the builder,
  calls the signer, base64 encodes the signed transaction, and wraps it as:

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "exact", "network": "solana:...", "...": "..." },
  "resource": { "url": "..." },
  "payload": { "transaction": "<base64 serialized signed transaction>" }
}
```

That JSON is itself base64 encoded as the `PAYMENT-SIGNATURE` header value.
This mirrors the Rust and TypeScript v2 wire contract while keeping wallet UI
integration outside the core SDK. Android MWA can adapt to the signer boundary
at the app layer, but it is not a core dependency here.

## Runtime support

The JVM builder:

1. Fetches the selected mint account when metadata is not present in the
   payment requirement.
2. Resolves SPL Token vs Token-2022.
3. Derives source and destination associated token accounts.
4. Builds compute-budget, SPL `transferChecked`, and memo instructions.
5. Signs only the client authority slot, leaving the managed fee payer slot for
   the facilitator/server side.

## Local checks

```bash
cd kotlin
gradle test
```

Focused interop:

```bash
cd tests/interop
X402_INTEROP_CLIENTS=kotlin X402_INTEROP_SERVERS=rust pnpm test:smoke
X402_INTEROP_CLIENTS=kotlin X402_INTEROP_SERVERS=typescript pnpm test:smoke
```
