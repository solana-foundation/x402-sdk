import { describe, expect, it } from "vitest";
import type { ImplementationDefinition } from "../src/implementations";
import { selectInteropPairs } from "../src/matrix";

function client(id: string): ImplementationDefinition {
  return { id, label: id, role: "client", command: ["true"], capabilities: ["exact"], enabled: true };
}

function server(id: string): ImplementationDefinition {
  return { id, label: id, role: "server", command: ["true"], capabilities: ["exact"], enabled: true };
}

describe("interop matrix selection", () => {
  const clients = [client("typescript"), client("rust"), client("python")];
  const servers = [server("typescript"), server("rust"), server("go")];

  it("selects the full Cartesian matrix when requested", () => {
    const pairs = selectInteropPairs(clients, servers, "full", "rust");

    expect(pairs.map(pair => `${pair.client.id}->${pair.server.id}`)).toEqual([
      "typescript->typescript",
      "typescript->rust",
      "typescript->go",
      "rust->typescript",
      "rust->rust",
      "rust->go",
      "python->typescript",
      "python->rust",
      "python->go",
    ]);
  });

  it("selects a reference spine by default", () => {
    const pairs = selectInteropPairs(clients, servers, "reference-spine", "rust");

    expect(pairs.map(pair => `${pair.client.id}->${pair.server.id}`)).toEqual([
      "typescript->rust",
      "rust->typescript",
      "rust->rust",
      "rust->go",
      "python->rust",
    ]);
  });

  it("falls back to explicit selected pairs when the reference is not active", () => {
    const pairs = selectInteropPairs([client("typescript")], [server("typescript")]);

    expect(pairs.map(pair => `${pair.client.id}->${pair.server.id}`)).toEqual([
      "typescript->typescript",
    ]);
  });
});
