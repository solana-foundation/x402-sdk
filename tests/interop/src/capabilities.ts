export type CapabilityStatus = "implemented" | "planned" | "missing";

export type RoleCapability = {
  client: CapabilityStatus;
  server: CapabilityStatus;
};

export type LanguageCapabilityMap = Record<string, RoleCapability>;

export type SchemeCapability = {
  status: CapabilityStatus;
  intentBoundary: "x402-scheme";
  defaultCi: boolean;
  languages: LanguageCapabilityMap;
};

export type IntentCapability = {
  status: CapabilityStatus;
  intentBoundary: "compatibility-intent";
  nativeX402Scheme: boolean;
  defaultCi: boolean;
  languages: LanguageCapabilityMap;
};

export const interopCapabilities = {
  schemes: {
    exact: {
      status: "implemented",
      intentBoundary: "x402-scheme",
      defaultCi: true,
      languages: {
        typescript: { client: "implemented", server: "implemented" },
        rust: { client: "implemented", server: "implemented" },
      },
    },
    upto: {
      status: "planned",
      intentBoundary: "x402-scheme",
      defaultCi: false,
      languages: {
        typescript: { client: "planned", server: "planned" },
        rust: { client: "planned", server: "planned" },
        python: { client: "planned", server: "planned" },
        go: { client: "planned", server: "planned" },
        ruby: { client: "planned", server: "planned" },
        lua: { client: "missing", server: "planned" },
        php: { client: "missing", server: "planned" },
      },
    },
  },
  intents: {
    session: {
      status: "planned",
      intentBoundary: "compatibility-intent",
      nativeX402Scheme: false,
      defaultCi: false,
      languages: {
        python: { client: "planned", server: "planned" },
        go: { client: "planned", server: "planned" },
        ruby: { client: "planned", server: "planned" },
        lua: { client: "missing", server: "planned" },
        php: { client: "missing", server: "planned" },
      },
    },
  },
} as const satisfies {
  schemes: Record<string, SchemeCapability>;
  intents: Record<string, IntentCapability>;
};
