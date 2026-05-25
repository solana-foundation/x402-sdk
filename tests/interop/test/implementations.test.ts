import { afterEach, describe, expect, it, vi } from "vitest";

async function loadImplementations() {
  vi.resetModules();
  return await import("../src/implementations");
}

describe("interop implementation selection", () => {
  afterEach(() => {
    delete process.env.X402_INTEROP_CLIENTS;
    delete process.env.X402_INTEROP_SERVERS;
  });

  it("enables all implementations by default", async () => {
    const { clientImplementations, serverImplementations } = await loadImplementations();

    expect(clientImplementations.map(implementation => implementation.id)).toEqual([
      "typescript",
      "rust",
    ]);
    expect(clientImplementations.every(implementation => implementation.enabled)).toBe(true);
    expect(serverImplementations.map(implementation => implementation.id)).toEqual([
      "typescript",
      "rust",
    ]);
    expect(serverImplementations.every(implementation => implementation.enabled)).toBe(true);
  });

  it("enables only selected implementations", async () => {
    process.env.X402_INTEROP_CLIENTS = "typescript";
    process.env.X402_INTEROP_SERVERS = "rust";

    const { clientImplementations, serverImplementations } = await loadImplementations();

    expect(clientImplementations.map(implementation => [implementation.id, implementation.enabled])).toEqual([
      ["typescript", true],
      ["rust", false],
    ]);
    expect(serverImplementations.map(implementation => [implementation.id, implementation.enabled])).toEqual([
      ["typescript", false],
      ["rust", true],
    ]);
  });

  it("rejects unknown selected client adapter ids", async () => {
    process.env.X402_INTEROP_CLIENTS = "typescript,not-real";

    await expect(loadImplementations()).rejects.toThrow(
      "Unknown X402_INTEROP_CLIENTS adapter id(s): not-real. Available adapters: typescript, rust",
    );
  });

  it("rejects unknown selected server adapter ids", async () => {
    process.env.X402_INTEROP_SERVERS = "rust,not-real";

    await expect(loadImplementations()).rejects.toThrow(
      "Unknown X402_INTEROP_SERVERS adapter id(s): not-real. Available adapters: typescript, rust",
    );
  });
});
