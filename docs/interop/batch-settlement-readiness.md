# Batch-settlement readiness for Solana x402

This note records the current source-truth boundary for adding
`batch-settlement` interop coverage to the Solana x402 SDK.

## Current source truth

- Checked against official docs on 2026-05-21.
- The x402 scheme exists for high-throughput payments using escrow, off-chain
  cumulative vouchers, claim, settle, and refund phases.
- The current public runtime binding is EVM-specific: buyers deposit ERC-20
  funds into escrow, sign cumulative off-chain vouchers, and sellers claim,
  settle, and refund through the EVM binding.
- x402 uses CAIP-2 network identifiers, including `solana:<genesisHash>` for
  Solana networks.
- A Solana/SVM binding still needs an explicit commitment format and on-chain
  settlement model before runtime adapters can be implemented safely.

References:

- https://docs.x402.org/schemes/batch-settlement
- https://docs.x402.org/core-concepts/network-and-token-support
- https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement.md
- https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement_evm.md

## Required SVM decisions

Before enabling runtime `batch-settlement` adapters, the Solana binding needs:

- channel or escrow account model
- voucher commitment format
- signer and delegated-signer rules
- replay protection and monotonic amount semantics
- claim, settle, refund, and timeout transaction semantics
- facilitator request and response payloads
- storage contract for pending vouchers and channel state
- interop fixture vectors for success and negative paths

## Harness policy

The interop harness may track `batch-settlement` readiness and fail if someone
marks Solana runtime support as implemented before the binding requirements are
resolved. Runtime support should remain blocked until the spec answers the
required SVM decisions above.

Local Solana interop adapters should advertise only `exact` until that happens.
They must not advertise `batch-settlement` or `session` capability names.
