# Source truth and current research

Use this file before writing protocol behavior. x402 is moving quickly; verify
official docs again before implementing a new scheme or network binding.

## Official x402 references

- x402 Foundation docs: <https://docs.x402.org/introduction>
- x402 docs index: <https://docs.x402.org/llms.txt>
- HTTP 402 flow and headers: <https://docs.x402.org/core-concepts/http-402>
- Network and token support: <https://docs.x402.org/core-concepts/network-and-token-support>
- Seller quickstart: <https://docs.x402.org/getting-started/quickstart-for-sellers>
- x402 Foundation repo: <https://github.com/x402-foundation/x402>
- Scheme specs: `x402-foundation/x402/specs/schemes/`

Important current facts from official docs:

- x402 v2 uses `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and
  `PAYMENT-RESPONSE` headers with base64-encoded JSON payloads.
- Network identifiers are CAIP-2 style. Solana networks use
  `solana:<genesisHash>`.
- Token support includes SPL Token and Token-2022 on Solana via SPL transfer.
- Seller examples register `ExactSvmScheme` for Solana exact payments.
- Docs describe `exact`, `upto`, and `batch-settlement` as separate schemes.
- Docs describe `upto` as currently EVM/Permit2-oriented.
- Docs describe `batch-settlement` as EVM escrow/voucher batching.

## Solana Foundation references discovered

GitHub search found Solana x402 references in:

- `solana-foundation/x402-sdk`: local Rust/TypeScript packages, interop harness,
  and PR language adapters.
- `solana-foundation/mpp-sdk`: `skills/pay-sdk-implementation` includes the
  `payment-sdk-implementation` skill, x402 intent reference stubs, and the
  formatting model for this skill.
- `solana-foundation/pay`: x402 client/tool references and `skills/pay/SKILL.md`.
- `solana-foundation/templates`: x402 Solana templates and ChatGPT kit config.
- `solana-foundation/kora`: x402 demo material.
- `solana-foundation/moneymq`: x402 types and transaction-related Rust code.
- `solana-foundation/solana-com`: x402 public site content.

Use these as related Solana context, not automatic protocol authority over the
local `x402-sdk` implementation.

## External skill research

- Cloudflare has `cloudflare/skills`, a broad platform skill repository, but no
  x402-specific implementation skill was found.
- Coinbase/x402 and x402 Foundation searches did not surface an official
  agent skill for x402 SDK implementation.
- `skills.sh` has third-party x402-adjacent skills (for example ICPay), but
  they are product-specific and must not define Solana x402 semantics.
- Therefore this skill should be treated as a local Solana x402 implementation
  checklist derived from official docs, local code, and maintainer feedback.

Useful non-authoritative integration references:

- Coinbase CDP x402 docs: <https://docs.cdp.coinbase.com/x402/welcome>
- Coinbase development fork: <https://github.com/coinbase/x402>
- Cloudflare x402 Agents docs:
  <https://developers.cloudflare.com/agents/agentic-payments/x402/>
- Cloudflare skills repo: <https://github.com/cloudflare/skills>

## Verification rule

When in doubt, prefer a blocked/planned matrix cell plus a readiness fixture
over inventing runtime behavior. Runtime code requires a local reference, an
official spec binding, or maintainer confirmation.
