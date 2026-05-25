export type ExactNegativeFixture = {
  id:
    | "rejects-network-mismatch"
    | "rejects-unsupported-scheme"
    | "rejects-missing-fee-payer";
  scheme: "exact" | "unsupported";
  acceptedNetwork: string;
  requiredNetwork: string;
  expectedReason: "network_mismatch" | "unsupported_scheme" | "missing_fee_payer";
  requiresSignedTransaction: boolean;
};

export const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

export const exactNegativeFixtures: ExactNegativeFixture[] = [
  {
    id: "rejects-network-mismatch",
    scheme: "exact",
    acceptedNetwork: SOLANA_MAINNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "network_mismatch",
    requiresSignedTransaction: false,
  },
  {
    id: "rejects-unsupported-scheme",
    scheme: "unsupported",
    acceptedNetwork: SOLANA_DEVNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "unsupported_scheme",
    requiresSignedTransaction: false,
  },
  {
    id: "rejects-missing-fee-payer",
    scheme: "exact",
    acceptedNetwork: SOLANA_DEVNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "missing_fee_payer",
    requiresSignedTransaction: false,
  },
];
