# @solana/x402

Solana implementation of x402.

## Goal

This package is intended to become the maintained Solana implementation that the canonical `@x402/svm` package can consume and re-export, so developers already using the canonical package see no API break.

## Dependency direction

```text
@solana/x402 -> @x402/core
@x402/svm -> @solana/x402 -> @x402/core
```

`@solana/x402` should not depend on `@x402/svm`, otherwise the canonical package cannot later wrap this one.

## Current shape

The package currently preserves the same high-level export layout as the canonical SVM package:

- `@solana/x402`
- `@solana/x402/v1`
- `@solana/x402/exact/client`
- `@solana/x402/exact/server`
- `@solana/x402/exact/facilitator`
- `@solana/x402/exact/v1/client`
- `@solana/x402/exact/v1/facilitator`

That makes the future compatibility layer in `@x402/svm` straightforward.
