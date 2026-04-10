# Interop tests

This package hosts the cross-language x402 conformance harness.

## Design

- The harness itself lives in `tests/interop`.
- Each implementation is exposed through a small adapter command.
- The harness spawns server adapters, waits for a JSON `ready` message, then runs client adapters against them.
- The harness starts an embedded Surfpool simnet via `surfpool-sdk`, funds test accounts, and passes the same RPC and signer environment into every adapter.
- The default matrix runs TypeScript and Rust clients against TypeScript and Rust servers.
- Future Rust, Go, Python, and Lua adapters can plug into the same process contract without changing the test runner.

## Current scope

The current reference flow is chain-backed and CI-friendly:

- the TypeScript reference server uses `@x402/core` HTTP server wrappers, `@solana/x402/server`, and `@solana/x402/facilitator`
- the TypeScript reference client uses `@x402/core` HTTP client wrappers and `@solana/x402/client`
- the Rust reference server uses the Rust crate's exact verifier, facilitator fee-payer co-signing, Surfpool RPC simulation, and transaction submission
- the Rust reference client uses the Rust crate's exact challenge parser and v2 `PAYMENT-SIGNATURE` builder
- the suite starts an embedded Surfpool simnet, funds a client signer with devnet USDC, pays a protected endpoint, and verifies the recipient ATA balance increases on-chain

That means the harness now validates end-to-end HTTP x402 interoperability, real Solana transaction construction, facilitator co-signing, settlement, and on-chain balance changes.

## Commands

```bash
cd typescript
pnpm install
pnpm --filter @solana/x402 build

cd ../tests/interop
pnpm install
pnpm test
```

## CI selection

Use these environment variables to filter the active matrix:

- `X402_INTEROP_CLIENTS=typescript,rust`
- `X402_INTEROP_SERVERS=typescript,rust`

If no filter is set, all stable adapters are enabled by default:

- clients: `typescript,rust`
- servers: `typescript,rust`

The suite performs a local socket-bind preflight. If the current environment forbids opening loopback ports, the e2e test is skipped instead of failing. In CI, where loopback sockets are available, the matrix runs normally.
