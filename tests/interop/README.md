# Interop tests

This package hosts the cross-language x402 conformance harness.

## Design

- The harness itself lives in `tests/interop`.
- Each implementation is exposed through a small adapter command.
- The harness spawns server adapters, waits for a JSON `ready` message, then runs client adapters against them.
- The harness starts an embedded Surfpool simnet via `surfpool-sdk`, funds test accounts, and passes the same RPC and signer environment into every adapter.
- The default matrix runs TypeScript and Rust clients against TypeScript and Rust servers.
- Future Go, Python, and Lua adapters can plug into the same process contract without changing the test runner.

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

If the TypeScript adapter cannot resolve `@solana/x402/...` subpaths, rebuild
the local package and refresh the interop package install:

```bash
cd typescript
pnpm --filter @solana/x402 build

cd ../tests/interop
pnpm install --force --frozen-lockfile
pnpm test
```

`@solana/x402` is installed from a local `file:` dependency, so `tests/interop`
needs to install after the TypeScript package has produced its `dist` files.

## Adapter contract

Adapters are ordinary process commands registered in
`tests/interop/src/implementations.ts`. They communicate with the harness by
writing one JSON object per line to stdout. Diagnostics, logs, and progress
messages should go to stderr so stdout remains machine-readable.

Server adapters must:

- bind an HTTP server on `127.0.0.1`
- emit exactly one `ready` message after the server is listening
- keep running until the harness sends `SIGTERM` or `SIGINT`
- protect `GET /protected` with x402 and return `{ "ok": true, "paid": true }`
  after settlement succeeds
- include a non-empty settlement value in the `x-fixture-settlement` response
  header on successful paid responses

The `ready` message shape is:

```json
{
  "type": "ready",
  "implementation": "typescript",
  "role": "server",
  "port": 3000,
  "capabilities": ["exact"]
}
```

Client adapters must:

- read `X402_INTEROP_TARGET_URL`
- request the target URL once to receive payment requirements
- build and submit an x402 payment for the supported Solana exact requirement
- emit exactly one `result` message before exiting
- exit with code `0` when the adapter completed the protocol attempt, even if
  the paid response itself is non-2xx; reserve non-zero exits for adapter
  crashes or invalid harness configuration

The `result` message shape is:

```json
{
  "type": "result",
  "implementation": "typescript",
  "role": "client",
  "ok": true,
  "status": 200,
  "responseHeaders": {
    "content-type": "application/json"
  },
  "responseBody": {
    "ok": true,
    "paid": true
  },
  "settlement": "5N..."
}
```

## Shared environment

The harness provides these variables to every adapter:

- `X402_INTEROP_RPC_URL`: Surfpool RPC URL.
- `X402_INTEROP_NETWORK`: Solana CAIP-2 network used by the scenario.
- `X402_INTEROP_MINT`: primary mint address funded by the harness.
- `X402_INTEROP_PRICE`: display price used by reference server adapters.
- `X402_INTEROP_PAY_TO`: recipient account funded and checked by the harness.
- `X402_INTEROP_CLIENT_SECRET_KEY`: JSON byte array for the client signer.
- `X402_INTEROP_FACILITATOR_SECRET_KEY`: JSON byte array for the facilitator
  fee-payer signer.

Optional variables:

- `X402_INTEROP_CLIENTS`: comma-separated client adapter IDs to run.
- `X402_INTEROP_SERVERS`: comma-separated server adapter IDs to run.
- `X402_INTEROP_TARGET_URL`: set by the harness for client adapters.
- `X402_INTEROP_EXTRA_OFFERED_MINTS`: comma-separated additional mints that
  server adapters may advertise alongside the primary mint.
- `X402_INTEROP_PREFER_CURRENCIES`: comma-separated symbols or mint addresses
  that client adapters may use to choose among offered requirements.

## CI selection

Use these environment variables to filter the active matrix:

- `X402_INTEROP_CLIENTS=typescript,rust`
- `X402_INTEROP_SERVERS=typescript,rust`

If no filter is set, all stable adapters are enabled by default:

- clients: `typescript,rust`
- servers: `typescript,rust`

The suite performs a local socket-bind preflight. If the current environment forbids opening loopback ports, the e2e test is skipped instead of failing. In CI, where loopback sockets are available, the matrix runs normally.
