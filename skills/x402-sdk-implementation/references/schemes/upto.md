# x402 upto

Use this reference for `x402/upto`.

## Current status

Official x402 docs describe `upto` as usage-based billing where the client
authorizes a maximum and the server settles the actual usage. Current official
examples describe EVM Permit2 support. Do not implement Solana runtime `upto`
semantics until an SVM binding exists in an official spec, local reference, or
maintainer guidance.

## Allowed work before SVM binding

- readiness fixtures
- capability diagnostics
- docs clarifying blocked/planned status
- interop scenario shells that fail closed with a clear unsupported message
- tests that prove the matrix does not advertise unsupported Solana runtime
  support

## Not allowed without source reference

- inventing an SVM authorization format
- reusing exact transfer semantics while naming the scheme `upto`
- claiming server/client support in README matrices
- enabling default interop runtime for Solana `upto`

## PR rule

The PR should say `blocked: missing SVM binding` or `readiness only` unless it
ships against an explicit Solana `upto` reference.
