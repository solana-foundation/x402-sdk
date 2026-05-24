# Lighthouse instruction allowlist — protocol-wide tracking note

## Status
Open. No spine implementation enforces a Lighthouse discriminator allowlist or
an account-count bound today. The Python adapter intentionally mirrors that
behavior to preserve cross-implementation parity.

## Background
The x402 `exact` SVM scheme allows up to three optional instructions trailing
the mandatory `SetComputeUnitLimit` + `SetComputeUnitPrice` + `TransferChecked`
prefix. Two optional programs are permitted:

- `MEMO_PROGRAM` (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) — payload-validated
  against `requirement.extra.memo`.
- `LIGHTHOUSE_PROGRAM` (`L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`) — wallet
  protection assertions injected by Phantom / Solflare on mainnet.

Spine references:

- Rust:       `rust/src/protocol/schemes/exact/verify.rs` L260-272 — `program == LIGHTHOUSE_PROGRAM` short-circuits with `continue`. No discriminator inspection, no account-count cap.
- TypeScript: `typescript/packages/x402/src/facilitator/exact/scheme.ts` L289-296 — same shape, plain `programAddress === LIGHTHOUSE_PROGRAM_ADDRESS` short-circuit.
- TypeScript (legacy v1): `typescript/packages/x402/src/v1/exact/facilitator/scheme.ts` L284-301 — same.

## Potential issue (raised in Codex PR #22 review)
Because the facilitator co-signs the transaction, it pays the compute-unit cost
of every Lighthouse instruction the client embeds. A maliciously-crafted
Lighthouse payload (unrecognized discriminator, oversized account list, etc.)
can therefore drive up the facilitator's per-tx cost or trigger CU exhaustion
that masks the real transfer.

Mitigation today is purely indirect:

1. `MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS` caps per-CU price.
2. `SetComputeUnitLimit` is bounded by the runtime maximum (`1.4M CU`).
3. Optional-instruction count is bounded to 3 (instructions[3..6]).

These bounds limit the worst case but do not prevent a client from filling its
budget with junk Lighthouse instructions the facilitator co-pays for.

## Proposal (protocol-wide, NOT Python-only)
Introduce a Lighthouse discriminator allowlist (e.g. `AssertAccountInfo`,
`AssertAccountData`, `AssertTokenAccount`, `AssertStakeAccount`, …) plus a
hard cap on `instruction.accounts.len()` per Lighthouse ix. The allowlist
must land in the Rust spine first, then be ported to TypeScript, Go, PHP,
Lua, Python, and the rest of the interop fleet in lockstep.

Until that lands, all adapters — including this Python one — accept any
Lighthouse instruction. See parity comment in
`python/src/x402_sdk/interop/server.py::_verify_optional_instructions`.

## Owner / next step
- File spine issue against `rust/` proposing the allowlist + bound.
- Sync with TS maintainers before changing behavior.
- Do NOT diverge in any single adapter; that would silently break interop
  test vectors that pass through real Phantom / Solflare transactions.
