import { describe, expect, it } from "vitest";
import { clientImplementations, serverImplementations } from "../src/implementations";

describe("interop implementation registry", () => {
  it("registers PHP as an exact server-only adapter", () => {
    expect(clientImplementations.some(implementation => implementation.id === "php")).toBe(false);

    const phpServer = serverImplementations.find(implementation => implementation.id === "php");

    expect(phpServer).toMatchObject({
      id: "php",
      role: "server",
      command: ["php", "bin/interop-server.php"],
      cwd: "../../php",
      requiredManifest: "../../php/composer.json",
      enabled: false,
    });
  });
});
