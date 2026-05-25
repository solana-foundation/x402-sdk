import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clientImplementations } from "../src/implementations";

// Source files that implement the boundary mutation hook for each client
// adapter id. The boundary.test.ts suite assumes every active client honours
// X402_INTEROP_MUTATE_ACCEPTED_NETWORK so the server rejection path is the
// reason the test fails — not "client never sent a mutated payment". This
// meta-test guards against a future client adapter silently passing the
// boundary suite by failing to implement the hook.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");

const clientSourceFiles: Record<string, string> = {
  typescript: path.join(REPO_ROOT, "tests/interop/src/fixtures/typescript/client.ts"),
  rust: path.join(REPO_ROOT, "rust/src/bin/interop_client.rs"),
};

describe("boundary mutation hook coverage", () => {
  for (const client of clientImplementations) {
    it(`${client.id} client implements X402_INTEROP_MUTATE_ACCEPTED_NETWORK`, () => {
      const sourcePath = clientSourceFiles[client.id];
      expect(
        sourcePath,
        `boundary-coverage.test.ts is missing a source mapping for client adapter "${client.id}". ` +
          `Either add the path to clientSourceFiles or remove the adapter from the boundary suite.`,
      ).toBeTruthy();

      const source = readFileSync(sourcePath, "utf8");
      expect(
        source.includes("X402_INTEROP_MUTATE_ACCEPTED_NETWORK"),
        `Client adapter "${client.id}" at ${sourcePath} does not reference ` +
          `X402_INTEROP_MUTATE_ACCEPTED_NETWORK. The boundary.test.ts suite would pass ` +
          `for the wrong reason (unmutated payment accepted). Implement the env hook ` +
          `before enabling this adapter in boundary tests.`,
      ).toBe(true);
    });
  }
});
