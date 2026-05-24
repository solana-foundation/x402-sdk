export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  command: string[];
  cwd?: string;
  requiredManifest?: string;
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
  {
    id: "lua",
    label: "Lua HTTP server",
    role: "server",
    command: ["lua", "bin/interop-server.lua"],
    cwd: "../../lua",
    requiredManifest: "../../lua/x402-sdk-svm-0.0.0-1.rockspec",
    enabled: isEnabled("lua", "X402_INTEROP_SERVERS", false),
  },
];
