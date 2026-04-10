# TypeScript

This workspace hosts the Solana x402 TypeScript implementation that we intend to maintain as the source implementation for the SVM path.

## Package strategy

- `@solana/x402` owns the Solana implementation
- `@solana/x402` depends on `@x402/core` for protocol types and interfaces
- the canonical `@x402/svm` package can later become a thin compatibility wrapper that re-exports this package's implementation and preserves its existing public API

That dependency direction avoids a cycle:

```text
@solana/x402 -> @x402/core
@x402/svm -> @solana/x402 -> @x402/core
```

and avoids the bad direction:

```text
@solana/x402 -> @x402/svm
@x402/svm -> @solana/x402
```
