import { supportedInteropCapabilities } from "./contracts";

export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  command: string[];
  capabilities: readonly string[];
  enabled: boolean;
};

type ImplementationTemplate = Omit<ImplementationDefinition, "enabled">;

function selectedIds(envName: string): string[] | undefined {
  const selected = process.env[envName];
  if (!selected || selected.trim() === "") {
    return undefined;
  }

  return [
    ...new Set(
      selected
        .split(",")
        .map(value => value.trim())
        .filter(Boolean),
    ),
  ];
}

function defineImplementations(
  envName: string,
  defaultEnabled: boolean,
  implementations: ImplementationTemplate[],
): ImplementationDefinition[] {
  const selected = selectedIds(envName);

  if (selected) {
    const knownIds = new Set(implementations.map(implementation => implementation.id));
    const unknownIds = selected.filter(id => !knownIds.has(id));

    if (unknownIds.length > 0) {
      throw new Error(
        `Unknown ${envName} adapter id(s): ${unknownIds.join(", ")}. Available adapters: ${implementations
          .map(implementation => implementation.id)
          .join(", ")}`,
      );
    }
  }

  return implementations.map(implementation => ({
    ...implementation,
    enabled: selected ? selected.includes(implementation.id) : defaultEnabled,
  }));
}

export const clientImplementations: ImplementationDefinition[] = defineImplementations(
  "X402_INTEROP_CLIENTS",
  true,
  [
    {
      id: "typescript",
      label: "TypeScript HTTP client",
      role: "client",
      command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
      capabilities: supportedInteropCapabilities,
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
      capabilities: supportedInteropCapabilities,
    },
  ],
);

export const serverImplementations: ImplementationDefinition[] = defineImplementations(
  "X402_INTEROP_SERVERS",
  true,
  [
    {
      id: "typescript",
      label: "TypeScript HTTP server",
      role: "server",
      command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
      capabilities: supportedInteropCapabilities,
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
      capabilities: supportedInteropCapabilities,
    },
  ],
);
