# Ruby x402 interop adapter

Minimal Ruby client/server adapters for the Solana `exact` interop harness.

## Test

```bash
ruby -I ruby/lib ruby/test/all_test.rb
```

## Coverage

Ruby coverage uses the standard library `Coverage` module to avoid adding a
dev-only gem dependency for this adapter. The command writes
`ruby/coverage/coverage.json`.

```bash
X402_RUBY_COVERAGE=1 ruby -I ruby/lib ruby/test/all_test.rb
```
