# Usage-Based Interop Roadmap

This roadmap defines the pre-implementation boundary for `upto` and `session`
interop work. It is intentionally limited to planning and harness capability
metadata. Payment implementation work should start in later PRs after these
expectations are reviewed.

## Current baseline

The interop harness currently validates Solana `exact` payments across the
TypeScript and Rust adapters. The stable matrix covers:

- TypeScript client to TypeScript server
- Rust client to TypeScript server
- TypeScript client to Rust server
- Rust client to Rust server
- USDC and PYUSD selection/fallback cases

This baseline must remain green while usage-based support is added.

## x402 scheme boundary

x402 usage-based work should start with native x402 scheme boundaries:

- `exact`: one request, fixed amount, immediate settlement.
- `upto`: one request, maximum authorization, settlement for actual usage.
- `batch-settlement`: repeated low-value requests, off-chain vouchers, batched
  on-chain redemption.

`session` is not treated as a native x402 scheme in this repository unless the
upstream x402 standard defines one. Until then, session-shaped flows belong to
an explicit compatibility intent path, not the native scheme registry.

## Planned `upto` coverage

`upto` is planned for:

- Rust client and server
- TypeScript client and server
- Python client and server
- Go client and server
- Ruby client and server
- Lua server only
- PHP server only

The first `upto` test contract should cover:

- maximum amount advertised by the server
- actual settlement amount chosen by the server
- zero settlement
- over-maximum rejection
- missing settlement override
- wrong scheme rejection

No adapter should be marked default-CI eligible for `upto` until it passes the
shared scenario contract locally and in CI.

## Session compatibility boundary

MPP-style `session` is a metered lifecycle, not the same thing as x402 `upto`:

- open a channel or escrow-like state
- submit cumulative vouchers as service is consumed
- optionally top up
- close or force-close
- persist latest voucher/state before delivering more service

Session compatibility is planned for:

- Python client and server
- Go client and server
- Ruby client and server
- Lua server only
- PHP server only

Session support should remain experimental until the target spec is stable
enough and durable server-state requirements are tested.

## PHP and Lua policy

PHP and Lua are server-side only for the initial roadmap. The harness should
represent their client role as `missing`, not silently skip it.

`SolDapper/solana-php` is a candidate dependency for future PHP Solana
transaction construction. It should be evaluated in the PHP implementation PR
before adding Composer metadata.

## Candidate PR stack

1. Scheme and intent boundary docs plus capability metadata tests.
2. Interop capability matrix surfaced in runner diagnostics.
3. `upto` scenario fixtures and negative cases.
4. TypeScript `upto` server support.
5. TypeScript `upto` client support.
6. Rust `upto` server support.
7. Rust `upto` client support.
8. Python `upto` adapter support.
9. Go `upto` adapter support.
10. Ruby `upto` adapter support.
11. Lua `upto` server adapter support.
12. PHP `upto` server adapter support.
13. Session detection fixtures.
14. Session experimental scenario contract.
15. Python session adapter support.
16. Go session adapter support.
17. Ruby session adapter support.
18. Lua session server adapter support.
19. PHP session server adapter support.
20. Subscription boundary docs and detection fixtures.
21. Subscription experimental diagnostics.
22. Matrix report artifacts.
23. Maintainer runbook for one language, one pair, and one scheme.
24. Experimental CI opt-in flags.
25. Final cleanup of planned/missing capability reporting.

## Non-goals for this PR

- Do not implement `upto`.
- Do not implement `session`.
- Do not add PHP, Ruby, Lua, Python, or Go adapters.
- Do not add new runtime dependencies.
- Do not change the default interop matrix.
- Do not make experimental scenarios block CI.
