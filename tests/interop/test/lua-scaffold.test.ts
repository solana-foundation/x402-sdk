import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  luaExactRuntimePromotionRequirements,
  luaExactRuntimeRequirements,
  luaExactServerBoundaryDecision,
} from "../src/fixtures/lua";

describe("Lua exact server", () => {
  const server = readFileSync("../../lua/bin/interop-server.lua", "utf8");
  const rockspec = readFileSync("../../lua/x402-sdk-svm-0.0.0-1.rockspec", "utf8");
  const readme = readFileSync("../../lua/README.md", "utf8");

  it("publishes a server-only exact readiness contract", () => {
    expect(server).toContain('{ "implementation", "lua" }');
    expect(server).toContain('{ "role", "server" }');
    expect(server).toContain('{ "capabilities", { "exact" } }');
    expect(server).not.toContain("plannedBoundaries");
    expect(server).not.toContain('path == "/upto"');
    expect(server).not.toContain('path == "/session"');
    expect(server).not.toContain('path == "/batch-settlement"');
  });

  it("keeps exact settlement behavior explicit", () => {
    expect(server).toContain('path == "/health"');
    expect(server).toContain('path == "/capabilities"');
    expect(server).toContain('path == "/exact"');
    expect(server).toContain('path == "/protected"');
    expect(server).toContain("exact_payment_required_header");
    expect(server).toContain("settle_exact_payment");
    expect(server).toContain("decode_payment_signature");
    expect(server).toContain("parse_versioned_transaction");
    expect(server).toContain("verify_exact_transaction");
    expect(server).toContain("sign_transaction_with_fee_payer");
    expect(server).toContain("send_transaction");
    expect(server).toContain("duplicate_settlement");
    expect(server).toContain("verify_token_accounts_exist");
    expect(server).toContain("local cache_key = transaction_cache_key(transaction)");
    expect(server).not.toContain("transaction_cache_key(payment.payload.transaction)");
    expect(server).not.toContain("lua_exact_server_not_implemented");
    expect(server).not.toContain("settlement_unavailable");
  });

  it("keeps ATA creation compatible with managed fee payer funding", () => {
    expect(server).toContain("account_key_for_index(account_keys, instruction.accounts[2]) == transfer.destination");
    expect(server).toContain("account_key_for_index(account_keys, instruction.accounts[3]) == base58_decode(requirement.payTo)");
    expect(server).toContain("account_key_for_index(account_keys, instruction.accounts[4]) == transfer.mint");
    expect(server).toContain("account_key_for_index(account_keys, instruction.accounts[5]) == base58_decode(system_program)");
    expect(server).toContain("account_key_for_index(account_keys, instruction.accounts[6]) == transfer.token_program");
    expect(server).not.toMatch(/for _, instruction in ipairs\\(instructions\\)[\\s\\S]*fee_payer_transferring_funds/);
    expect(server).toContain("if transfer.authority == fee_payer or transfer.source == fee_payer then");
  });

  it("builds exact SVM challenges from interop env", () => {
    expect(server).toContain("exact_challenge_json");
    expect(server).toContain("exact_requirement_json");
    expect(server).toContain("exact_accepts_json");
    expect(server).toContain('read_env("X402_INTEROP_PAY_TO"');
    expect(server).toContain('read_env("X402_INTEROP_FEE_PAYER"');
    expect(server).toContain('read_env("X402_INTEROP_MINT"');
    expect(server).toContain('read_env("X402_INTEROP_PRICE"');
    expect(server).toContain('"maxTimeoutSeconds", 60');
    expect(server).toContain("base64_encode(exact_challenge_json())");
  });

  it("adds extra offered mints to the exact challenge without changing payment terms", () => {
    expect(server).toContain('read_env("X402_INTEROP_EXTRA_OFFERED_MINTS", "")');
    expect(server).toContain("for raw_mint in extra_mints:gmatch");
    expect(server).toContain("table.insert(mints, mint)");
    expect(server).toContain("return token_2022_program");
    expect(server).toContain("return default_token_program");
    expect(server).toContain('"CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"');
    expect(server).toContain('"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"');
    expect(server).toContain("for _, mint in ipairs(exact_offered_mints()) do");
    expect(server).toContain("exact_requirement_json(mint)");
    expect(server).toContain("exact_requirement_table(mint)");
  });

  it("declares narrow Lua runtime dependencies", () => {
    expect(rockspec).toContain('"lua >= 5.4"');
    expect(rockspec).toContain('"luasocket"');
    expect(rockspec).toContain('"luasec"');
    expect(rockspec).toContain('"dkjson"');
    expect(rockspec).toContain('"luasodium"');
    expect(rockspec).toContain('"luazen"');
  });

  it("forces TLS peer verification on HTTPS RPC unless explicitly insecure", () => {
    expect(server).toContain('pcall(require, "ssl.https")');
    expect(server).toContain('url:sub(1, 8) == "https://"');
    expect(server).toContain('request.verify = insecure and "none" or "peer"');
    expect(server).toContain('request.protocol = "tlsv1_2"');
    expect(server).toContain('X402_INTEROP_RPC_INSECURE');
  });

  it("documents the server-only boundary with ATA PDA derivation closed", () => {
    expect(luaExactServerBoundaryDecision).toMatchObject({
      status: "server-only-exact",
      runtimeImplemented: true,
      runtimeProbe: "pnpm run test:probe:lua-server",
    });
    // The PDA-derivation gap closed alongside the P1.2 fix
    // (`derive_associated_token_address` in lua/bin/interop-server.lua).
    expect(luaExactServerBoundaryDecision.remainingGaps).not.toContain(
      "Associated Token Account PDA derivation is not independently recomputed in Lua yet.",
    );
    expect(readme).toContain("server-only Lua adapter");
    expect(readme).toContain("Lua exact server runtime is implemented");
    expect(readme).toContain("Associated Token Account PDA derivation");
  });

  it("independently re-derives the destination ATA and sweeps fee-payer from all instructions", () => {
    expect(server).toContain("derive_associated_token_address");
    expect(server).toContain("find_program_address");
    expect(server).toContain("ed25519_on_curve");
    expect(server).toContain("invalid_exact_svm_payload_destination_ata_mismatch");
    expect(server).toContain("verify_fee_payer_not_instruction_account");
    expect(server).toContain("invalid_exact_svm_payload_transaction_fee_payer_in_instruction_accounts");
  });

  it("documents intentional Lighthouse parity with the Rust and TypeScript spines", () => {
    expect(server).toContain("Intentional spine parity");
    expect(server).toContain("rust/src/protocol/schemes/exact/verify.rs:266");
    expect(server).toContain("typescript/packages/x402/src/facilitator/exact/scheme.ts:300");
  });

  it("maps Lua runtime promotion to explicit evidence", () => {
    const runtimeRequirementIds = new Set(
      luaExactRuntimeRequirements.map(requirement => requirement.id),
    );

    expect(luaExactRuntimePromotionRequirements.every(requirement => requirement.runtimeEligible)).toBe(
      true,
    );
    expect(
      luaExactRuntimePromotionRequirements.every(
        requirement =>
          requirement.requirement === "interop-smoke" ||
          runtimeRequirementIds.has(requirement.requirement),
      ),
    ).toBe(true);
    expect(luaExactRuntimePromotionRequirements).toContainEqual({
      requirement: "interop-smoke",
      runtimeEligible: true,
      provingCommand: "pnpm run test:probe:lua-server",
      requiredEvidence: "typescript-client-to-lua-server-smoke",
    });
  });
});
