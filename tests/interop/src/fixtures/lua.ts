export type LuaExactRuntimeRequirement = {
  id:
    | "lua-toolchain"
    | "http-server"
    | "json-codec"
    | "base64-codec"
    | "base58-codec"
    | "ed25519-signing"
    | "transaction-shortvec-parser"
    | "json-rpc-client";
  requiredFor: "exact-server";
  status: "available" | "local-helper";
  candidate?: string;
};

export type LuaExactRuntimePromotionRequirement = {
  requirement: LuaExactRuntimeRequirement["id"] | "interop-smoke";
  runtimeEligible: boolean;
  provingCommand: "pnpm run test:probe:lua-static" | "pnpm run test:probe:lua-server";
  requiredEvidence:
    | "lua-process-starts"
    | "http-server-readiness"
    | "exact-challenge-json-parity"
    | "payment-envelope-json-decode"
    | "base64-payment-header-decode"
    | "fee-payer-public-key-base58"
    | "fee-payer-ed25519-signature"
    | "required-signer-shortvec-index"
    | "send-transaction-json-rpc"
    | "typescript-client-to-lua-server-smoke";
};

export const luaExactServerBoundaryDecision = {
  status: "server-only-exact",
  runtimeImplemented: true,
  runtimeProbe: "pnpm run test:probe:lua-server",
  dependencyPolicy:
    "Keep Lua exact optional and avoid publish/package polish until maintainers accept the server runtime shape.",
  currentRockspecDependencies: ["lua >= 5.4", "luasocket", "luasec", "dkjson", "luasodium", "luazen"],
  remainingGaps: [
    "Lua exact server stays opt-in in the interop matrix through X402_INTEROP_SERVERS=lua.",
  ],
} as const;

export const luaExactRuntimeRequirements: LuaExactRuntimeRequirement[] = [
  {
    id: "lua-toolchain",
    requiredFor: "exact-server",
    status: "available",
    candidate: "lua >= 5.4",
  },
  {
    id: "http-server",
    requiredFor: "exact-server",
    status: "available",
    candidate: "luasocket",
  },
  {
    id: "json-codec",
    requiredFor: "exact-server",
    status: "available",
    candidate: "dkjson",
  },
  {
    id: "base64-codec",
    requiredFor: "exact-server",
    status: "local-helper",
  },
  {
    id: "base58-codec",
    requiredFor: "exact-server",
    status: "local-helper",
  },
  {
    id: "ed25519-signing",
    requiredFor: "exact-server",
    status: "available",
    candidate: "luasodium",
  },
  {
    id: "transaction-shortvec-parser",
    requiredFor: "exact-server",
    status: "local-helper",
  },
  {
    id: "json-rpc-client",
    requiredFor: "exact-server",
    status: "available",
    candidate: "luasocket",
  },
];

export const luaExactRuntimePromotionRequirements: LuaExactRuntimePromotionRequirement[] = [
  {
    requirement: "lua-toolchain",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "lua-process-starts",
  },
  {
    requirement: "http-server",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "http-server-readiness",
  },
  {
    requirement: "json-codec",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-static",
    requiredEvidence: "exact-challenge-json-parity",
  },
  {
    requirement: "json-codec",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "payment-envelope-json-decode",
  },
  {
    requirement: "base64-codec",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "base64-payment-header-decode",
  },
  {
    requirement: "base58-codec",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "fee-payer-public-key-base58",
  },
  {
    requirement: "ed25519-signing",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "fee-payer-ed25519-signature",
  },
  {
    requirement: "transaction-shortvec-parser",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "required-signer-shortvec-index",
  },
  {
    requirement: "json-rpc-client",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "send-transaction-json-rpc",
  },
  {
    requirement: "interop-smoke",
    runtimeEligible: true,
    provingCommand: "pnpm run test:probe:lua-server",
    requiredEvidence: "typescript-client-to-lua-server-smoke",
  },
];
