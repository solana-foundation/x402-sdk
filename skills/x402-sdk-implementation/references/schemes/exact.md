# x402 exact

Use this reference for `x402/exact` language ports.

## Current status

- Local Rust and TypeScript are the canonical Solana exact references.
- x402 Foundation docs show Solana exact support through `ExactSvmScheme`.
- Language ports must mirror Rust/TypeScript behavior before being enabled in
  the interop matrix.

## Required behavior

Exact SVM payments must verify:

- `scheme` is `exact`.
- network matches the accepted requirement.
- asset/mint matches the accepted requirement.
- token program matches the accepted requirement.
- amount and decimals match the accepted requirement.
- destination account is the expected recipient ATA.
- optional ATA creation, when supported, creates the expected ATA.
- managed fee payer is not the transfer source.
- managed fee payer signs only as fee payer and never as token authority.
- route/resource binding prevents cross-route replay.
- duplicate settlement detection uses decoded transaction bytes or an
  equivalently stable identity.

## Test cases to mirror

- happy path exact payment
- split payments / multiple accepted requirements
- ATA already exists
- ATA creation required
- network mismatch
- asset/mint mismatch
- token program mismatch
- amount mismatch
- route/resource mismatch
- malformed payment headers
- duplicate settlement
- sendTransaction failure releases duplicate cache claim
- preferred currency selection scans all candidate requirements

## Interop shape

Use Rust and TypeScript as the reference spine:

- target client -> Rust server
- TypeScript client -> target server
- Rust client -> target server when available

Server-only languages should prove `TypeScript client -> target server`.
Client-only languages should prove `target client -> Rust/TypeScript server`.
