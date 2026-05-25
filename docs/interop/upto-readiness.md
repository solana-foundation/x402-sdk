# x402 `upto` readiness

This note defines the first reviewable slice for M5 `upto` work in this
Solana-focused SDK repo. It is a readiness and boundary gate only; it does not
add Solana `upto` runtime behavior.

## Source truth

Current official x402 references describe `upto` as a usage-based scheme where
the client authorizes a maximum amount and the server/facilitator settles the
actual amount after the request.

Source checked at: 2026-05-21.

The current implementation boundary is:

- `upto` is available on EVM networks only.
- Official SDK availability is TypeScript, Go, and Python.
- EVM `upto` uses Permit2.
- EIP-3009 is not supported for `upto` because it signs an exact amount.
- `PaymentRequirements.amount` is phase-dependent:
  - verification: maximum authorized amount
  - settlement: actual amount to charge
- settlement amount must be less than or equal to the authorized maximum.
- zero settlement is valid and should not require an on-chain write.
- authorization is single-use.

References:

- https://docs.x402.org/schemes/upto
- https://docs.x402.org/getting-started/quickstart-for-sellers
- https://docs.x402.org/llms.txt

## Local gaps

This repository is Solana-only. Official source truth does not currently define
Solana `upto`, so runtime work is blocked until there is either an official SVM
scheme or a maintainer-approved design.

The local blockers are:

- no official SVM `upto` scheme document
- no Solana client authorization envelope that can authorize a cap while
  allowing actual settlement below the cap
- no facilitator settlement authority model for charging the actual amount
  without rewriting a fixed signed transfer
- no zero-settlement proof that avoids a chain write
- no shared over-maximum settlement rejection proof

## First PR boundary

The first PR should only add:

- source-truth fixture data for official `upto` availability
- a local readiness report
- tests that prevent Solana `upto` runtime from being marked ready or locally
  advertised
- this documentation note

The first PR should not add:

- Solana `upto` client payload construction
- facilitator settlement code
- fixed SPL transfer-as-`upto` behavior
- batch/session compatibility semantics
- new dependencies

## Verification

From `tests/interop`:

```bash
pnpm test:upto-readiness
pnpm upto:readiness
pnpm typecheck
```
