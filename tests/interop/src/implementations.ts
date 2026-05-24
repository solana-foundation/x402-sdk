export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  command: string[];
  enabled: boolean;
};

function isEnabled(id: string, envName: string, defaultEnabled: boolean): boolean {
  const selected = process.env[envName];
  if (!selected || selected.trim() === "") {
    return defaultEnabled;
  }

  return selected
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .includes(id);
}

export const clientImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP client",
    role: "client",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_CLIENTS", true),
  },
  {
    id: "rust",
    label: "Rust HTTP client",
    role: "client",
    command: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_client",
    ],
    enabled: isEnabled("rust", "X402_INTEROP_CLIENTS", true),
  },
  {
    id: "swift",
    label: "Swift HTTP client",
    role: "client",
    command: ["swift", "run", "--package-path", "../../swift", "x402-swift-interop-client"],
    // The Swift adapter requires CryptoKit and Apple's Swift toolchain. The
    // public CI matrix for the interop job runs on ubuntu-latest, which does
    // not ship a Swift toolchain by default. Guard with a runtime OS check so
    // accidentally enabling `swift` in X402_INTEROP_CLIENTS on Linux is a
    // no-op rather than a hard failure during `swift run` bootstrap.
    enabled:
      isEnabled("swift", "X402_INTEROP_CLIENTS", false) &&
      process.platform === "darwin",
  },
];

export const serverImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP server",
    role: "server",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_SERVERS", true),
  },
  {
    id: "rust",
    label: "Rust HTTP server",
    role: "server",
    command: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_server",
    ],
    enabled: isEnabled("rust", "X402_INTEROP_SERVERS", true),
  },
];
