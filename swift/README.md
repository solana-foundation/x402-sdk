# x402 Swift exact client scaffold

This directory contains an experimental SwiftPM package for the Solana x402
`exact` client path. It is intentionally client-only and does not add package
publishing metadata.

## Scope

- Parse canonical x402 v2 `accepts` challenges from `PAYMENT-REQUIRED` or JSON
  response bodies.
- Select Solana `exact` offers by preferred network and optional currency list.
- Build a v0 Solana transaction with compute budget, SPL `transferChecked`, and
  memo instructions.
- Sign through an injected `SolanaSigner` abstraction.
- Provide a `MemorySolanaSigner` for 64-byte Solana secret-key fixtures on
  Apple platforms with CryptoKit.
- Emit a base64 x402 `PAYMENT-SIGNATURE` envelope.
- Provide an opt-in interop client executable:

```bash
cd tests/interop
X402_INTEROP_CLIENTS=swift X402_INTEROP_SERVERS=typescript pnpm test -- --run
```

## Current PR readiness

The default associated token account resolver now performs pure-Swift PDA
derivation with an Ed25519 compressed-point curve check, and unit tests pin the
derived ATA addresses against Solana Kit reference output.

The Swift adapter remains opt-in in the interop matrix until a full chain-backed
Swift client smoke run is green and reviewed. Do not treat Swift as part of the
default reference spine until that runtime lane is enabled in CI.

The unit tests cover x402 challenge selection, signer abstraction, blockhash
injection, default and injected ATA resolution, transaction serialization, and
payment header envelope construction without depending on live RPC.

## Verification

```bash
cd swift
swift test
```
