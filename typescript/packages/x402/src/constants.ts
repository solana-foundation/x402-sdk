/**
 * Legacy Solana network identifiers used by x402 v1.
 */
export const SOLANA_NETWORK = "solana";
export const SOLANA_DEVNET_NETWORK = "solana-devnet";
export const SOLANA_TESTNET_NETWORK = "solana-testnet";

/**
 * CAIP family used by Solana x402 v2 registrations.
 */
export const SOLANA_CAIP_FAMILY = "solana:*";

/**
 * x402 protocol version and wire field names.
 */
export const X402_VERSION_FIELD = "x402Version";
export const X402_VERSION_V1 = 1;
export const X402_VERSION_V2 = 2;

/**
 * x402 HTTP header names.
 */
export const X402_V1_PAYMENT_HEADER = "X-PAYMENT";
export const X402_V1_PAYMENT_REQUIRED_HEADER = "X-PAYMENT-REQUIRED";
export const X402_V1_PAYMENT_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";
export const X402_V2_PAYMENT_HEADER = "PAYMENT-SIGNATURE";
export const X402_V2_PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const X402_V2_PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

/**
 * Canonical sign-in extension key and HTTP header.
 */
export const SIGN_IN_WITH_X = "sign-in-with-x";
export const SIGN_IN_WITH_X_HEADER = "SIGN-IN-WITH-X";

/**
 * Current default x402 header names.
 */
export const PAYMENT_SIGNATURE_HEADER = X402_V2_PAYMENT_HEADER;
export const PAYMENT_REQUIRED_HEADER = X402_V2_PAYMENT_REQUIRED_HEADER;
export const PAYMENT_RESPONSE_HEADER = X402_V2_PAYMENT_RESPONSE_HEADER;
