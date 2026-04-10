import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ExactSvmScheme as CanonicalClientScheme,
  registerExactSvmScheme as registerCanonicalClientScheme,
} from "../../src/exact/client";
import {
  ExactSvmScheme as ExistingClientScheme,
  registerExactSvmScheme as registerExistingClientScheme,
} from "../../src/client/exact";
import {
  ExactSvmScheme as CanonicalServerScheme,
  registerExactSvmScheme as registerCanonicalServerScheme,
} from "../../src/exact/server";
import {
  ExactSvmScheme as ExistingServerScheme,
  registerExactSvmScheme as registerExistingServerScheme,
} from "../../src/server/exact";
import {
  ExactSvmScheme as CanonicalFacilitatorScheme,
  registerExactSvmScheme as registerCanonicalFacilitatorScheme,
} from "../../src/exact/facilitator";
import {
  ExactSvmScheme as ExistingFacilitatorScheme,
  registerExactSvmScheme as registerExistingFacilitatorScheme,
} from "../../src/facilitator/exact";
import { ExactSvmScheme as RootExactScheme } from "../../src/exact";
import { ExactSvmScheme as RootScheme } from "../../src";
import { ExactSvmSchemeV1 as CanonicalV1ClientScheme } from "../../src/exact/v1/client";
import { ExactSvmSchemeV1 as ExistingV1ClientScheme } from "../../src/v1/exact/client";
import { ExactSvmSchemeV1 as CanonicalV1FacilitatorScheme } from "../../src/exact/v1/facilitator";
import { ExactSvmSchemeV1 as ExistingV1FacilitatorScheme } from "../../src/v1/exact/facilitator";

const canonicalSvmExportPaths = [
  "./exact",
  "./exact/client",
  "./exact/server",
  "./exact/facilitator",
  "./exact/v1",
  "./exact/v1/client",
  "./exact/v1/facilitator",
] as const;

describe("@x402/svm compatibility surface", () => {
  it("keeps canonical @x402/svm server and client import paths available", () => {
    expect(RootExactScheme).toBe(RootScheme);

    expect(CanonicalClientScheme).toBe(ExistingClientScheme);
    expect(registerCanonicalClientScheme).toBe(registerExistingClientScheme);

    expect(CanonicalServerScheme).toBe(ExistingServerScheme);
    expect(registerCanonicalServerScheme).toBe(registerExistingServerScheme);

    expect(CanonicalFacilitatorScheme).toBe(ExistingFacilitatorScheme);
    expect(registerCanonicalFacilitatorScheme).toBe(registerExistingFacilitatorScheme);
  });

  it("keeps canonical @x402/svm v1 import paths available", () => {
    expect(CanonicalV1ClientScheme).toBe(ExistingV1ClientScheme);
    expect(CanonicalV1FacilitatorScheme).toBe(ExistingV1FacilitatorScheme);
  });

  it("publishes canonical @x402/svm export paths from package.json", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, unknown> };

    for (const exportPath of canonicalSvmExportPaths) {
      expect(packageJson.exports[exportPath]).toBeDefined();
    }
  });
});
