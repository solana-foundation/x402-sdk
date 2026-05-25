export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  requiredManifest?: string;
  enabled: boolean;
};

function isEnabled(id: string, envName: string, defaultEnabled: boolean): boolean {
  const selected = parseSelectedImplementationIds(process.env[envName]);
  if (selected.length === 0) {
    return defaultEnabled;
  }

  return selected.includes(id);
}

export function parseSelectedImplementationIds(selected?: string): string[] {
  if (!selected || selected.trim() === "") {
    return [];
  }

  return selected
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
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
    id: "python",
    label: "Python HTTP client",
    role: "client",
    command: ["python3", "-m", "x402_sdk.interop.client"],
    cwd: "../../python",
    env: { PYTHONPATH: "src" },
    requiredManifest: "../../python/pyproject.toml",
    enabled: isEnabled("python", "X402_INTEROP_CLIENTS", false),
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
    id: "python",
    label: "Python HTTP server",
    role: "server",
    command: ["python3", "-m", "x402_sdk.interop.server"],
    cwd: "../../python",
    env: { PYTHONPATH: "src" },
    requiredManifest: "../../python/pyproject.toml",
    enabled: isEnabled("python", "X402_INTEROP_SERVERS", false),
  },
];
