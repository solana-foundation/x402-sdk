# x402-sdk

Solana-only x402 SDKs.

This repository is modeled after `solana-mpp-sdk`, but scoped to x402 and intentionally limited to Solana. The long-term shape is still multi-language and multi-scheme, but not multi-chain.

## Current status

- `rust/`: initial Solana `exact` scheme implementation imported from the existing draft and adapted toward the x402 wire format
- `typescript/`: initial `@solana/x402` workspace bootstrapped from the canonical SVM package layout
- `tests/interop/`: shared cross-language conformance harness with process-based client/server adapters and an embedded Surfpool simnet
- target coverage: 95% per implementation, starting with Rust

## Planned layout

```text
x402-sdk/
├── rust/
├── go/
├── typescript/
├── python/
├── lua/
└── tests/interop/
```

The repo will keep the same broad organization as `solana-mpp-sdk`: per-language SDKs, shared interop tests, and one protocol surface across implementations.

The interop harness uses the canonical TypeScript client and server against a local Surfpool runtime so CI exercises real Solana `exact` payments, not fixture-only envelopes. Other languages can attach to the same adapter contract as their client/server paths mature.

## Rust quick start

```bash
cd rust
cargo test
cargo llvm-cov --fail-under-lines 95 --summary-only
```

## TypeScript quick start

```bash
cd typescript
pnpm install
pnpm --filter @solana/x402 build
pnpm --filter @solana/x402 test:coverage
```

## Interop quick start

```bash
cd typescript
pnpm install
pnpm --filter @solana/x402 build

cd ../tests/interop
pnpm install
pnpm test
```
