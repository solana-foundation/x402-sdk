import { describe, expect, it } from "vitest";
import {
  assertSvmBatchSettlementRuntimeReady,
  batchSettlementScheme,
  batchSettlementSourceTruth,
  currentBatchSettlementBindings,
  formatBatchSettlementReadinessReport,
  getBatchSettlementBinding,
  requiredSvmBindingDecisions,
} from "../src/batch-settlement-readiness";
import { supportedInteropCapabilities, unsupportedReadinessCapabilities } from "../src/contracts";
import { clientImplementations, serverImplementations } from "../src/implementations";

describe("batch-settlement readiness", () => {
  it("tracks the official scheme name and source truth", () => {
    expect(batchSettlementScheme).toBe("batch-settlement");
    expect(batchSettlementSourceTruth.docs).toContain("/schemes/batch-settlement");
    expect(batchSettlementSourceTruth.sourceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(batchSettlementSourceTruth.evmSpec).toContain("scheme_batch_settlement_evm.md");
  });

  it("marks EVM as implemented and Solana as blocked until an SVM binding exists", () => {
    expect(getBatchSettlementBinding("eip155:84532")).toMatchObject({
      status: "implemented",
      reason: expect.stringContaining("EVM escrow"),
    });
    expect(getBatchSettlementBinding("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z")).toMatchObject({
      status: "blocked",
      reason: expect.stringContaining("No public SVM escrow/voucher"),
    });
  });

  it("keeps the SVM decision gate explicit", () => {
    expect(requiredSvmBindingDecisions).toContain("voucher-commitment-format");
    expect(requiredSvmBindingDecisions).toContain("claim-settle-refund-timeout-transactions");
    expect(() => assertSvmBatchSettlementRuntimeReady([])).toThrow(/missing: channel-or-escrow-account-model/);
    expect(() => assertSvmBatchSettlementRuntimeReady(requiredSvmBindingDecisions)).not.toThrow();
  });

  it("does not accidentally advertise Solana runtime support", () => {
    const solanaBindings = currentBatchSettlementBindings.filter((binding) => binding.network.startsWith("solana:"));

    expect(solanaBindings).toHaveLength(1);
    expect(solanaBindings[0]?.network).toBe("solana:*");
    expect(solanaBindings[0]?.status).toBe("blocked");
    expect(
      currentBatchSettlementBindings.some(
        (binding) => binding.network.startsWith("solana:") && binding.status === "implemented",
      ),
    ).toBe(false);
  });

  it("does not advertise batch-settlement or session in local interop capabilities", () => {
    const implementations = [...clientImplementations, ...serverImplementations];

    expect(supportedInteropCapabilities).toEqual(["exact"]);
    for (const implementation of implementations) {
      expect(implementation.capabilities).toEqual(["exact"]);
      for (const unsupported of unsupportedReadinessCapabilities) {
        expect(implementation.capabilities).not.toContain(unsupported);
      }
    }
  });

  it("prints a maintainer-readable readiness report", () => {
    const report = formatBatchSettlementReadinessReport();

    expect(report).toContain("x402 batch-settlement readiness");
    expect(report).toContain("- solana:*: blocked");
    expect(report).toContain("checked: 2026-05-21");
    expect(report).toContain("required SVM decisions:");
  });
});
