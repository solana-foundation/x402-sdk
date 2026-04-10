set shell := ["bash", "-uc"]

default:
    @just --list

rs-build:
    cd rust && cargo build

rs-test:
    cd rust && cargo test

rs-test-cover:
    cd rust && cargo llvm-cov --fail-under-lines 95 --summary-only

rs-fmt:
    cd rust && cargo fmt

rs-lint:
    cd rust && cargo clippy -- -D warnings

ts-install:
    cd typescript && pnpm install

ts-build:
    cd typescript && pnpm build

ts-test:
    cd typescript && pnpm test

ts-test-cover:
    cd typescript && pnpm --filter @solana/x402 test:coverage

ts-lint:
    cd typescript && pnpm lint

interop-install:
    cd tests/interop && pnpm install

interop-test:
    cd tests/interop && pnpm test
