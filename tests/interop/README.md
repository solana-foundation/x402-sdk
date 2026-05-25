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

For the CI-style exact-payment smoke suite:

```bash
X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:smoke
```

`reference-spine` runs every active client against the reference server and the
reference client against every active server. The default reference is `rust`,
but it can be changed with `X402_INTEROP_REFERENCE=<implementation>`.

To run the full Cartesian client/server smoke matrix:

```bash
X402_INTEROP_PROFILE=full pnpm test:smoke
```

Boundary and negative vectors are kept outside the default CI smoke profile:

```bash
pnpm test:boundaries
```

The first boundary suite mutates the client payment envelope's
`accepted.network` after a valid payment is built. Servers must reject that
payment and must not emit a settlement header.

Domain-specific scenarios can stay selectable through Vitest filters. For
example, the current smoke script selects the exact-payment tests by matching
`client pays`, while the multi-currency vectors remain available in the full
test suite.

Useful package scripts:

```bash
pnpm run test:process
pnpm run test:e2e
pnpm run test:typescript
pnpm run test:rust
pnpm run test:matrix
```

Run one client/server pair while debugging an adapter:

```bash
X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=rust pnpm test
X402_INTEROP_CLIENTS=rust X402_INTEROP_SERVERS=typescript pnpm test
```

The selectors must match adapter IDs from
`tests/interop/src/implementations.ts`. Unknown IDs fail before the matrix runs
so typos do not silently reduce coverage.

Run one language against itself:

```bash
X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=typescript pnpm test
X402_INTEROP_CLIENTS=rust X402_INTEROP_SERVERS=rust pnpm test
```

Run one language across the opposite side of the matrix:

```bash
X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=typescript,rust pnpm test
X402_INTEROP_CLIENTS=typescript,rust X402_INTEROP_SERVERS=rust pnpm test
```

For the M5 `upto` readiness gate:

```bash
pnpm test:upto-readiness
pnpm upto:readiness
```

This gate records current official `upto` availability as EVM-only and keeps
Solana runtime support and local `upto` capability advertising blocked until an
official SVM scheme or maintainer-approved design exists.

## Batch-settlement readiness

`batch-settlement` is tracked as a readiness gate instead of a runtime Solana
adapter today. The public x402 binding is EVM-specific, so the harness records
the missing SVM decisions and fails if Solana support is accidentally marked as
implemented before those decisions are resolved.

```bash
pnpm test:batch-readiness
pnpm batch:readiness
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

## Adapter layout

Keep adapter PRs narrow and language-scoped. A new adapter should add one
client or one server role at a time, then opt into the default matrix only after
the role is stable locally and in CI.

Recommended locations:

- TypeScript fixtures: `tests/interop/src/fixtures/typescript/`
- Rust adapters: `rust/src/bin/interop_client.rs` and
  `rust/src/bin/interop_server.rs`
- Python adapters: `tests/interop/adapters/python/`
- Go adapters: `tests/interop/adapters/go/`
- Ruby adapters: `tests/interop/adapters/ruby/`
- PHP adapters: `tests/interop/adapters/php/`
- Lua adapters: `tests/interop/adapters/lua/`

For non-TypeScript languages, keep the adapter process contract at the boundary:
the language adapter reads the shared environment, performs the x402 flow, and
emits the `ready` or `result` JSON line. The TypeScript harness should not import
language-specific code directly.

## Dependency policy

Adapters should prefer the language SDK already present in this repository. Add
new dependencies only when they are needed for protocol correctness or local
execution, such as signing, Solana transaction construction, HTTP serving, or
JSON handling.

Dependency changes should stay in the same PR as the adapter role that needs
them. Avoid adding framework bindings for the harness itself; adapters should be
small process fixtures rather than full web framework examples.

Server adapters must:

- bind an HTTP server on `127.0.0.1`
- emit exactly one `ready` message after the server is listening
- keep running until the harness sends `SIGTERM` or `SIGINT`
- include the active scenario scheme in `capabilities`
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

Adapters should report the active scenario scheme in `capabilities` so the
harness can enforce scheme matching as new `upto` or `batch-settlement`
scenarios are added.

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
  "settlement": "5N...",
  "paymentHeader": "PAYMENT-SIGNATURE-base64..."
}
```

`paymentHeader` is optional and reserved for the TypeScript reference
client today; it carries the exact PAYMENT-SIGNATURE / X-PAYMENT header
value the client sent on the paid request, so the cross-server scenario
harness can capture it and replay it elsewhere.

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
- `X402_INTEROP_REUSE_CREDENTIAL`: when set, the TypeScript reference client
  skips its own 402 payload construction and submits the supplied
  PAYMENT-SIGNATURE (v2) / X-PAYMENT (v1) header verbatim. Used by the
  cross-server portability and idempotent-resubmit scenarios in
  `test/cross-server-scenarios.test.ts` to replay a credential built for
  one server against another (or against the same server twice). Other
  client adapters do not need to implement this hook yet; the TS client
  drives the cross-server matrix across every active server.
- `X402_INTEROP_CROSS_SERVER=1`: enables the cross-server portability and
  idempotent-resubmit suite in `test/cross-server-scenarios.test.ts`.
  Default `pnpm test` skips this suite because each case spins up two
  Surfpool-backed servers and a real on-chain settlement before the
  replay attempt; opt in only when sweeping for replay / wrong-server
  acceptance regressions (MPP M1 closure §19.6).

## CI selection

Use these environment variables to filter the active matrix:

- `X402_INTEROP_CLIENTS=typescript,rust`
- `X402_INTEROP_SERVERS=typescript,rust`
- `X402_INTEROP_PROFILE=reference-spine|full`
- `X402_INTEROP_REFERENCE=rust`

If no filter is set, all stable adapters are enabled by default:

- clients: `typescript,rust`
- servers: `typescript,rust`

The suite performs a local socket-bind preflight. If the current environment forbids opening loopback ports, the e2e test is skipped instead of failing. In CI, where loopback sockets are available, the matrix runs normally.

## Troubleshooting

- `Unknown X402_INTEROP_CLIENTS adapter id(s)` or
  `Unknown X402_INTEROP_SERVERS adapter id(s)`: check the selected IDs against
  `tests/interop/src/implementations.ts`.
- `Unexpected ... payload`: the adapter wrote a JSON object that does not match
  the process contract. Keep logs on stderr and reserve stdout for the single
  `ready` or `result` message.
- `Adapter stderr:` in a failure: the harness captured stderr from the child
  adapter and attached the tail to the thrown error.
- `Timed out waiting for ...`: the adapter started but did not emit the expected
  stdout message before the harness timeout.
- TypeScript package resolution errors usually mean `@solana/x402` needs to be
  rebuilt in `typescript` before reinstalling `tests/interop`.
