# Language skill pairing

Use the x402 skill for protocol and PR readiness. Pair it with one language
skill only for idioms, tests, and maintainability. **Language skills are not
protocol authority.** Protocol truth comes from the local Rust spine, the
TypeScript reference package, and the official x402 specs.

## Skills.sh mapping

Per-language skills picked from skills.sh (May 2026 survey) for x402 SDK PR
review. Cite at least one HIGH-confidence skill from this table in the PR
"Skill pass" section, and show it was actually applied (a specific concern
from the skill resolved in the diff), not just name-dropped.

| Language | Skill | Source | Confidence | Why useful |
|---|---|---|---|---|
| TypeScript | `0xbigboss/claude-code/typescript-best-practices` | skills.sh | HIGH | Strong style checklist; high installs and audit pass. |
| Rust | `cargo fmt` / `cargo clippy` / `cargo test` + local Rust reference | local | HIGH | Strongest local authority. Generic Rust skills are optional. |
| Go | `jeffallan/claude-skills/golang-pro` | skills.sh | HIGH | Enforces gofmt + golangci-lint, idiomatic error handling, context propagation, table-driven tests with 80%+ coverage and fuzzing — matches the interop coverage gate. |
| Go (alt) | `mindrally/skills/go` | skills.sh | MEDIUM | Broader idiomatic Go 1.21+ patterns (interfaces, concurrency, modules). |
| Python | `wshobson/agents/python-testing-patterns` | skills.sh | HIGH | pytest fixtures, mocking, parameterization, TDD — covers signed-payload test matrices. |
| Python (alt) | `miles990/claude-software-skills/python` | skills.sh | MEDIUM | Modern Python type-hints + async + Pythonic idioms. |
| Ruby | `mindrally/skills/ruby` | skills.sh | MEDIUM | Ruby 3.x idioms + RSpec. Do not force RSpec if the repo uses a stdlib-first test stack. |
| Ruby (alt) | `jeffallan/claude-skills/rails-expert` | GitHub | MEDIUM | Rails/AR/Sidekiq/RSpec — applies if the adapter ships Rack/Rails middleware. |
| PHP | `jpcaparas/superpowers-laravel/laravel:code-review-requests` | skills.sh | HIGH | Explicitly covers payment processing, security, auth, validation review — closest direct match for a payment SDK. |
| PHP (alt) | `jeffallan/claude-skills/laravel-specialist` | skills.sh | HIGH | PHP 8.2+ strict typing, PSR-12, eager-loading. |
| PHP (alt) | `asyrafhussin/agent-skills/php-best-practices` | skills.sh | HIGH | Strong PHP 8.x fit: strict types, PSR, version-aware rules, security checks. |
| Lua | `mindrally/skills/lua` | skills.sh | MEDIUM | Tables/metatables, pcall/xpcall error handling, local-var perf, LDoc typing, modular require(). Only credible Lua skill on skills.sh. |
| Lua (fallback) | `luarocks/lua-style-guide` | GitHub | LOW | Community standard for consistency. |
| Swift | `avdlee/swiftui-agent-skill/swiftui-expert-skill` | skills.sh | HIGH (UI-leaning) | Well-known Swift author; flags deprecated APIs, modern patterns, state modeling, Codable payloads. |
| Swift (fallback) | Apple Swift API Design Guidelines | swift.org | LOW | Authoritative for naming, error throwing, value semantics. Use for SDK-core surface; do not use SwiftUI skills there. |
| Kotlin | `mindrally/skills` (kotlin-development) | skills.sh | MEDIUM | Clean Kotlin code, naming, function design, data class handling. |
| Kotlin (alt) | `new-silvermoon/awesome-android-agent-skills` (kotlin-concurrency-expert) | GitHub | MEDIUM | Coroutines + StateFlow. Android-tilted. |
| Kotlin (authoritative) | `Kotlin/kotlin-agent-skills` | JetBrains GitHub | HIGH | Official JetBrains skill collection. Not on skills.sh. |

## Coverage gaps on skills.sh

- No programming-language filter; entries found via Google + repo indices.
- **Ruby / Lua / Swift / Kotlin**: thin coverage; pair with fallback guides.
- **Swift**: only UI-focused (SwiftUI) skills exist on skills.sh; nothing wire-protocol/Codable-specific.
- **Kotlin**: strongest collection (`Kotlin/kotlin-agent-skills`) is JetBrains' GitHub repo, not skills.sh.

## How to apply

Before marking a PR ready, add a short PR comment with this shape:

- x402 skill/checklist used (cite this skill PR).
- language skill(s) used (cite at least one HIGH; cite alt or fallback if no HIGH exists for the language).
- Specific finding(s) from each cited skill that the diff resolves.
- Greptile feedback state.
- Local and CI verification commands + results.
- Capability matrix cells proven by tests/interop.

Do not install weak or unrelated skills just to satisfy process. If no
HIGH-confidence skill exists for a language, state that and use the official
language tooling plus the fallback guides above.
