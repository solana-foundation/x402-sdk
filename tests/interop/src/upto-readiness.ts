export type UptoSourceTruth = {
  scheme: "upto";
  sourceCheckedAt: string;
  availability: {
    networks: "evm-only";
    sdkLanguages: Array<"typescript" | "go" | "python">;
  };
  authorization: {
    evmPrimitive: "permit2";
    unsupportedForUpto: Array<"eip3009">;
  };
  settlement: {
    paymentRequirementsAmountAtVerification: "maximum";
    paymentRequirementsAmountAtSettlement: "actual";
    actualAmountMustBeLessThanOrEqualMaximum: true;
    zeroSettlementRequiresChainWrite: false;
    singleUseAuthorization: true;
  };
  docs: {
    quickstartForSellers: string;
    schemeGuide: string;
    docsIndex: string;
  };
};

export type UptoLocalReadinessGap = {
  id:
    | "no-official-svm-upto"
    | "no-client-authorization-envelope"
    | "no-facilitator-settlement-authority"
    | "no-zero-settlement-proof"
    | "no-over-maximum-enforcement";
  blocksRuntime: true;
  evidenceRequired: string;
};

export const uptoSourceTruth: UptoSourceTruth = {
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
};

export const uptoLocalReadinessGaps: UptoLocalReadinessGap[] = [
  {
    id: "no-official-svm-upto",
    blocksRuntime: true,
    evidenceRequired: "official x402 SVM upto scheme document or maintainer-approved design",
  },
  {
    id: "no-client-authorization-envelope",
    blocksRuntime: true,
    evidenceRequired: "single-use client authorization that permits charging less than the cap",
  },
  {
    id: "no-facilitator-settlement-authority",
    blocksRuntime: true,
    evidenceRequired: "facilitator path that can settle the actual amount without rewriting a signed transfer",
  },
  {
    id: "no-zero-settlement-proof",
    blocksRuntime: true,
    evidenceRequired: "zero-settlement test proving no on-chain transaction is required",
  },
  {
    id: "no-over-maximum-enforcement",
    blocksRuntime: true,
    evidenceRequired: "shared rejection test for settlement amounts above the authorized maximum",
  },
];

export function isUptoRuntimeReadyForNetwork(network: string): boolean {
  return network.startsWith("eip155:");
}

export function getUptoSvmRuntimeStatus(): "blocked" | "ready" {
  return uptoLocalReadinessGaps.some((gap) => gap.blocksRuntime) ? "blocked" : "ready";
}

export function formatUptoReadinessReport(): string {
  const lines = [
    "x402 upto readiness",
    `source-checked-at: ${uptoSourceTruth.sourceCheckedAt}`,
    `availability: ${uptoSourceTruth.availability.networks}`,
    `authorization: ${uptoSourceTruth.authorization.evmPrimitive}`,
    `sdk-languages: ${uptoSourceTruth.availability.sdkLanguages.join(",")}`,
    `svm-runtime: ${getUptoSvmRuntimeStatus()}`,
    `docs: ${uptoSourceTruth.docs.schemeGuide}`,
  ];

  for (const gap of uptoLocalReadinessGaps) {
    lines.push(`gap:${gap.id} evidence:${gap.evidenceRequired}`);
  }

  return lines.join("\n");
}
