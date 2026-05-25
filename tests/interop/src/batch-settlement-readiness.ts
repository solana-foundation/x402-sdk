export type BatchSettlementBindingStatus = "implemented" | "blocked";

export interface BatchSettlementNetworkBinding {
  network: string;
  status: BatchSettlementBindingStatus;
  reason?: string;
}

export const batchSettlementScheme = "batch-settlement" as const;

export const batchSettlementSourceTruth = {
  docs: "https://docs.x402.org/schemes/batch-settlement",
  networkDocs: "https://docs.x402.org/core-concepts/network-and-token-support",
  sourceCheckedAt: "2026-05-21",
  genericSpec:
    "https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement.md",
  evmSpec:
    "https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement_evm.md",
} as const;

export const requiredSvmBindingDecisions = [
  "channel-or-escrow-account-model",
  "voucher-commitment-format",
  "signer-and-delegated-signer-rules",
  "replay-protection-and-monotonic-amounts",
  "claim-settle-refund-timeout-transactions",
  "facilitator-payloads",
  "durable-channel-storage",
  "success-and-negative-fixtures",
] as const;

export const currentBatchSettlementBindings: BatchSettlementNetworkBinding[] = [
  {
    network: "eip155:*",
    status: "implemented",
    reason: "Official docs describe the current runtime as EVM escrow, off-chain vouchers, and batched redemption.",
  },
  {
    network: "solana:*",
    status: "blocked",
    reason: "No public SVM escrow/voucher batch-settlement binding exists yet.",
  },
];

export function getBatchSettlementBinding(network: string): BatchSettlementNetworkBinding | undefined {
  return currentBatchSettlementBindings.find((binding) => {
    if (binding.network.endsWith(":*")) {
      const networkPrefix = binding.network.slice(0, -1);
      return network.startsWith(networkPrefix);
    }

    return binding.network === network;
  });
}

export function assertSvmBatchSettlementRuntimeReady(resolvedDecisions: readonly string[]): void {
  const missing = requiredSvmBindingDecisions.filter((decision) => !resolvedDecisions.includes(decision));

  if (missing.length > 0) {
    throw new Error(`SVM batch-settlement runtime support is blocked; missing: ${missing.join(", ")}`);
  }
}

export function formatBatchSettlementReadinessReport(): string {
  const lines = [
    "x402 batch-settlement readiness",
    "",
    `scheme: ${batchSettlementScheme}`,
    "network bindings:",
    ...currentBatchSettlementBindings.map((binding) => {
      const suffix = binding.reason ? ` (${binding.reason})` : "";
      return `- ${binding.network}: ${binding.status}${suffix}`;
    }),
    "",
    "required SVM decisions:",
    ...requiredSvmBindingDecisions.map((decision) => `- ${decision}`),
    "",
    "source truth:",
    `- checked: ${batchSettlementSourceTruth.sourceCheckedAt}`,
    ...Object.entries(batchSettlementSourceTruth)
      .filter(([key]) => key !== "sourceCheckedAt")
      .map(([key, url]) => `- ${key}: ${url}`),
  ];

  return lines.join("\n");
}
