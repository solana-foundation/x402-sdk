import { describe, expect, it } from "vitest";
import { localSolanaInteropCapabilities } from "../src/contracts";
import {
  formatUptoReadinessReport,
  getUptoSvmRuntimeStatus,
  isUptoRuntimeReadyForNetwork,
  uptoLocalReadinessGaps,
  uptoSourceTruth,
} from "../src/upto-readiness";

describe("upto readiness", () => {
  it("pins the official upto availability before Solana runtime work", () => {
    expect(uptoSourceTruth).toMatchObject({
      scheme: "upto",
      sourceCheckedAt: "2026-05-21",
      availability: {
        networks: "evm-only",
        sdkLanguages: ["typescript", "go", "python"],
      },
      authorization: {
        evmPrimitive: "permit2",
        unsupportedForUpto: ["eip3009"],
      },
      settlement: {
        paymentRequirementsAmountAtVerification: "maximum",
        paymentRequirementsAmountAtSettlement: "actual",
        actualAmountMustBeLessThanOrEqualMaximum: true,
        zeroSettlementRequiresChainWrite: false,
        singleUseAuthorization: true,
      },
      docs: {
        quickstartForSellers: "https://docs.x402.org/getting-started/quickstart-for-sellers",
        schemeGuide: "https://docs.x402.org/schemes/upto",
        docsIndex: "https://docs.x402.org/llms.txt",
      },
    });
    expect(uptoSourceTruth.sourceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not mark Solana networks as runtime-ready for upto", () => {
    expect(isUptoRuntimeReadyForNetwork("eip155:84532")).toBe(true);
    for (const network of [
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "solana:mainnet",
      "solana:*",
    ]) {
      expect(isUptoRuntimeReadyForNetwork(network)).toBe(false);
    }
  });

  it("does not advertise upto in local Solana interop capabilities", () => {
    expect(localSolanaInteropCapabilities).toEqual(["exact"]);
    expect(localSolanaInteropCapabilities).not.toContain("upto");
  });

  it("keeps local Solana gaps explicit and blocking", () => {
    expect(uptoLocalReadinessGaps.map(gap => gap.id)).toEqual([
      "no-official-svm-upto",
      "no-client-authorization-envelope",
      "no-facilitator-settlement-authority",
      "no-zero-settlement-proof",
      "no-over-maximum-enforcement",
    ]);
    for (const gap of uptoLocalReadinessGaps) {
      expect(gap.blocksRuntime).toBe(true);
    }
    expect(getUptoSvmRuntimeStatus()).toBe("blocked");
  });

  it("prints a concise report for PR review", () => {
    expect(formatUptoReadinessReport()).toContain("availability: evm-only");
    expect(formatUptoReadinessReport()).toContain("source-checked-at: 2026-05-21");
    expect(formatUptoReadinessReport()).toContain("svm-runtime: blocked");
    expect(formatUptoReadinessReport()).toContain("docs: https://docs.x402.org/schemes/upto");
    expect(formatUptoReadinessReport()).toContain("gap:no-official-svm-upto");
  });
});
