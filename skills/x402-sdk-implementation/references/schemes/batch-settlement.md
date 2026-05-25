# x402 batch-settlement

Use this reference for `x402/batch-settlement` and any x402 session-like
discussion.

## Current status

Official x402 docs describe batch settlement as high-frequency micropayment
support where the buyer deposits into escrow, signs off-chain vouchers, and the
seller redeems value onchain in batches. Current official docs describe this as
EVM escrow/voucher batching. Do not implement Solana runtime semantics until an
SVM binding exists in an official spec, local reference, or maintainer guidance.

## Relationship to session wording

Do not add a separate `x402/session` implementation unless maintainers confirm
that exact cell name and semantics. If the requested behavior is long-lived
usage-based x402 payments, treat it as a batch-settlement question first.

## Allowed work before SVM binding

- readiness fixtures
- capability diagnostics
- docs clarifying EVM-only/currently-blocked Solana runtime status
- interop scenario shells that fail closed with an unsupported message
- tests proving the matrix does not advertise unsupported runtime support

## Not allowed without source reference

- inventing Solana escrow or voucher layout
- copying MPP session voucher semantics into x402 without confirmation
- claiming server/client support in README matrices
- enabling default Solana batch-settlement runtime interop

## PR rule

The PR should say `blocked: missing SVM binding` or `readiness only` unless it
ships against an explicit Solana batch-settlement reference.
