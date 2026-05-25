---
name: x402-sdk-implementation
description: Implement or review Solana x402 SDK language support, interop adapters, CI coverage gates, and PR readiness. Use when adding x402 exact, upto, or batch-settlement support for Go, Python, Ruby, PHP, Lua, Swift, Kotlin, Rust, or TypeScript, or when preparing an x402 language PR for review.
---

# x402 SDK implementation

This skill guides Solana Foundation `x402-sdk` implementation work. It follows
the same progressive-disclosure shape as the MPP `payment-sdk-implementation`
skill: load this file first, then read only the reference files for the scheme,
language, and PR state in scope.

## Authoritative source order

1. Local `solana-foundation/x402-sdk` Rust and TypeScript code, tests, and
   `tests/interop` behavior.
2. x402 Foundation docs/specs and `x402-foundation/x402`.
3. Solana SPL Token, Token-2022, ATA, transaction, and signer references.
4. Coinbase/CDP and Cloudflare x402 material as integration examples, not
   protocol authority when they conflict with the layers above.

Read [source-truth.md](references/source-truth.md) before making protocol
claims, adding dependencies, or changing a capability matrix.

## Compatibility matrix cells

Choose the exact cell and role for the current pass. Do not mark a cell
implemented unless the related unit tests, coverage, and interop evidence are
green.

| Cell | Reference | Current rule |
|---|---|---|
| `x402/exact` | [exact.md](references/schemes/exact.md) | Implemented locally in Rust/TypeScript; language ports must mirror the reference behavior. |
| `x402/upto` | [upto.md](references/schemes/upto.md) | Official docs describe EVM Permit2 support. Solana runtime stays blocked/planned until an SVM binding exists. |
| `x402/batch-settlement` | [batch-settlement.md](references/schemes/batch-settlement.md) | Official docs describe EVM escrow/vouchers. Solana runtime stays blocked/planned until an SVM binding exists. |

`x402/session` is **not** an official x402 scheme. The published x402 scheme
set is `exact`, `upto`, and `batch-settlement`. If MPP session-style work
needs to land on x402, treat it as a batch-settlement extension (see
[batch-settlement.md](references/schemes/batch-settlement.md)) until
maintainers confirm a distinct scheme exists.

## Workflow

1. **Confirm scope.** Identify language, role (`client`, `server`,
   `client+server`, `server-only`, `client-only`), and matrix cell.
2. **Load references.** Read [source-truth.md](references/source-truth.md), then
   the scheme reference for the selected cell. Read
   [language-skills.md](references/language-skills.md) for the language pass.
3. **Wire quality first.** Ensure formatter, unit tests, coverage reporting,
   and CI shape are present before enabling new interop defaults.
4. **Mirror reference tests.** For `exact`, compare Rust and TypeScript coverage
   and port the same edge cases into the target language.
5. **Implement missing behavior.** Keep dependencies minimal. Add dependencies
   only when they improve signing, transaction construction, HTTP interop, or
   coverage materially.
6. **Turn on interop.** Register the adapter in `tests/interop`, run focused
   Rust/TypeScript reference-spine checks, then enable CI when the failures are
   understood and fixed.
7. **Document last.** README matrices must show evidence-backed status only:
   `implemented`, `server-only`, `client-only`, `planned`, or
   `blocked: missing SVM binding`.
8. **Prepare PR review evidence.** Read [pr-readiness.md](references/pr-readiness.md)
   and include the language skill used, Greptile status, coverage numbers, and
   interop pairs in the PR comment.

## Hard rules

- Interop is the truth. A unit-test-green SDK that fails Rust/TypeScript interop
  is not complete.
- No speculative checkmarks in README or PR matrices.
- No Solana `upto` or `batch-settlement` runtime semantics without a source
  reference for the SVM binding.
- Exact payments must bind network, asset, token program, destination, amount,
  route/resource, and payment identity.
- Token-program mismatches fail closed. SPL Token and Token-2022 are not
  interchangeable unless the decoded transaction matches the advertised
  requirement.
- Managed fee payer must never become token source or transfer authority.
- Duplicate settlement guards must use stable decoded transaction bytes or an
  equivalently collision-resistant identity.
- Do not commit model signatures, generated-by markers, emojis, broad
  unexplained dependencies, or secrets.
