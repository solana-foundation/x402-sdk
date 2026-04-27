import { base58 } from "@scure/base";
import { safeBase64Decode, safeBase64Encode } from "@x402/core/utils";

import {
  SIGN_IN_WITH_X,
  SIGN_IN_WITH_X_HEADER,
  SOLANA_DEVNET_NETWORK,
  SOLANA_NETWORK,
  SOLANA_TESTNET_NETWORK,
} from "../constants";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
} from "../protocol/schemes/exact/constants";

/**
 * Solana SIWX signature type.
 */
export type SignatureType = "ed25519";

/**
 * Solana SIWX signature scheme.
 */
export type SignatureScheme = "siws";

/**
 * Chain advertised by a sign-in-with-x extension challenge.
 */
export interface SupportedChain {
  /** CAIP-2 chain identifier. */
  chainId: string;
  /** Signature type required for this chain. */
  type: SignatureType;
  /** Optional canonical signature scheme hint. */
  signatureScheme?: SignatureScheme;
}

/**
 * Server-provided sign-in challenge fields.
 */
export interface SIWxExtensionInfo {
  /** Expected HTTP host name for the protected resource. */
  domain: string;
  /** Expected URI origin for the protected resource. */
  uri: string;
  /** Human-readable statement to include in the signed message. */
  statement?: string;
  /** SIWS message version. */
  version: string;
  /** Server-generated nonce. */
  nonce: string;
  /** RFC3339 issuance time. */
  issuedAt: string;
  /** Optional RFC3339 expiration time. */
  expirationTime?: string;
  /** Optional RFC3339 not-before time. */
  notBefore?: string;
  /** Optional server request identifier. */
  requestId?: string;
  /** Optional resource list to include in the signed message. */
  resources?: string[];
}

/**
 * sign-in-with-x challenge extension carried by x402 payment-required responses.
 */
export interface SIWxExtension extends SIWxExtensionInfo {
  /** Chains the client may choose to sign for. */
  supportedChains: SupportedChain[];
}

/**
 * Full SIWX message fields before the signature is attached.
 */
export interface CompleteSIWxInfo extends SIWxExtensionInfo {
  /** Signer address. */
  address: string;
  /** CAIP-2 chain identifier selected by the client. */
  chainId: string;
  /** Signature type used by the client. */
  type: SignatureType;
  /** Optional canonical signature scheme hint. */
  signatureScheme?: SignatureScheme;
}

/**
 * SIWX payload encoded into the SIGN-IN-WITH-X header.
 */
export interface SIWxPayload extends CompleteSIWxInfo {
  /** Base58-encoded Ed25519 signature over the SIWS message. */
  signature: string;
}

/**
 * Validation result returned by SIWX verification helpers.
 */
export interface SIWxValidationResult {
  /** True when the payload passed the requested checks. */
  valid: boolean;
  /** Human-readable failure reason when validation failed. */
  error?: string;
}

/**
 * Options for selecting a supported chain from an SIWX challenge.
 */
export interface SIWxChainSelectionOptions {
  /** Preferred CAIP-2 chain identifier or legacy Solana network name. */
  preferredChainId?: string;
  /** Chain identifiers the client is willing to sign for, in preference order. */
  supportedChainIds?: string[];
}

/**
 * Options for validating SIWX message metadata.
 */
export interface SIWxMessageValidationOptions {
  /** Clock used for issuance, expiration, and not-before checks. */
  now?: Date;
  /** Maximum age in milliseconds from issuedAt. Defaults to five minutes. */
  maxAgeMs?: number;
  /** Expected nonce for this challenge. */
  expectedNonce?: string;
  /** Optional server-side nonce validation hook. */
  validateNonce?: (nonce: string) => boolean | Promise<boolean>;
}

/**
 * Minimal @solana/kit-style message signer.
 */
export interface KitMessageSigner {
  /** Base58 signer address. */
  address: string;
  /** Sign one or more raw message payloads. */
  signMessages(messages: readonly KitSignMessageInput[]): Promise<readonly KitSignMessageOutput[]>;
}

/**
 * Input accepted by @solana/kit-style message signers.
 */
export interface KitSignMessageInput {
  /** Raw message bytes to sign. */
  content: Uint8Array;
  /** Existing signatures for the message. */
  signatures: Record<string, Uint8Array>;
}

/**
 * Output returned by @solana/kit-style message signers.
 */
export type KitSignMessageOutput = Record<string, Uint8Array>;

/**
 * Minimal wallet-adapter-style message signer.
 */
export interface WalletAdapterMessageSigner {
  /** Wallet public key. */
  publicKey: { toBase58?: () => string; toString: () => string };
  /** Sign one raw message payload. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/**
 * Signer accepted by SIWX helpers.
 */
export type SIWxSigner = KitMessageSigner | WalletAdapterMessageSigner;

/**
 * Minimal x402 payment-required shape containing extensions.
 */
export interface SIWxPaymentRequired {
  /** Optional x402 extensions object. */
  extensions?: Record<string, unknown>;
}

interface CompatibleChainLike {
  chainId: string;
  type: string;
  signatureScheme?: string;
}

type Ed25519SubtleCrypto = {
  importKey: (
    format: "raw",
    keyData: Uint8Array,
    algorithm: { name: "Ed25519" },
    extractable: false,
    keyUsages: readonly ["verify"],
  ) => Promise<unknown>;
  verify: (
    algorithm: { name: "Ed25519" },
    key: unknown,
    signature: Uint8Array,
    data: Uint8Array,
  ) => Promise<boolean>;
};

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const SOLANA_CHAIN_PREFIX = "solana:";

/**
 * Solana mainnet SIWX chain.
 */
export const SOLANA_MAINNET_SIWX_CHAIN: SupportedChain = {
  chainId: SOLANA_MAINNET_CAIP2,
  type: "ed25519",
  signatureScheme: "siws",
};

/**
 * Solana devnet SIWX chain.
 */
export const SOLANA_DEVNET_SIWX_CHAIN: SupportedChain = {
  chainId: SOLANA_DEVNET_CAIP2,
  type: "ed25519",
  signatureScheme: "siws",
};

/**
 * Solana testnet SIWX chain.
 */
export const SOLANA_TESTNET_SIWX_CHAIN: SupportedChain = {
  chainId: SOLANA_TESTNET_CAIP2,
  type: "ed25519",
  signatureScheme: "siws",
};

/**
 * Default Solana SIWX chains advertised by servers.
 */
export const DEFAULT_SOLANA_SIWX_CHAINS = [
  SOLANA_MAINNET_SIWX_CHAIN,
  SOLANA_DEVNET_SIWX_CHAIN,
  SOLANA_TESTNET_SIWX_CHAIN,
] as const;

/**
 * Build a Solana SIWX extension for a payment-required response.
 *
 * @param info - Server-issued challenge fields
 * @param supportedChains - Supported Solana chains
 * @returns SIWX extension object for `extensions["sign-in-with-x"]`
 */
export function buildSIWxExtension(
  info: SIWxExtensionInfo,
  supportedChains: readonly SupportedChain[] = DEFAULT_SOLANA_SIWX_CHAINS,
): SIWxExtension {
  return {
    ...info,
    supportedChains: supportedChains.map(chain => ({ ...chain })),
  };
}

/**
 * Extract the SIWX extension from a payment-required response.
 *
 * @param paymentRequired - x402 payment-required response
 * @returns Parsed SIWX extension when present
 */
export function getSIWxExtension(paymentRequired: SIWxPaymentRequired): SIWxExtension | undefined {
  const extension = paymentRequired.extensions?.[SIGN_IN_WITH_X];
  if (!isObject(extension)) return undefined;
  const supportedChains = extension.supportedChains;
  if (!Array.isArray(supportedChains)) return undefined;
  const domain = getStringField(extension, "domain");
  const uri = getStringField(extension, "uri");
  const version = getStringField(extension, "version");
  const nonce = getStringField(extension, "nonce");
  const issuedAt = getStringField(extension, "issuedAt");
  if (!domain || !uri || !version || !nonce || !issuedAt) return undefined;

  return {
    domain,
    uri,
    statement: typeof extension.statement === "string" ? String(extension.statement) : undefined,
    version,
    nonce,
    issuedAt,
    expirationTime:
      typeof extension.expirationTime === "string" ? String(extension.expirationTime) : undefined,
    notBefore: typeof extension.notBefore === "string" ? String(extension.notBefore) : undefined,
    requestId: typeof extension.requestId === "string" ? String(extension.requestId) : undefined,
    resources: Array.isArray(extension.resources)
      ? extension.resources.map(resource => String(resource))
      : undefined,
    supportedChains: supportedChains.filter(isSupportedChain).map(chain => ({ ...chain })),
  };
}

/**
 * Select the Solana SIWX chain a client should sign for.
 *
 * @param extension - SIWX extension advertised by the server
 * @param options - Optional client chain preferences
 * @returns Selected supported chain
 */
export function selectSIWxChain(
  extension: SIWxExtension,
  options: SIWxChainSelectionOptions = {},
): SupportedChain {
  const compatibleChains = extension.supportedChains.filter(isCompatibleSolanaChain);
  if (compatibleChains.length === 0) {
    throw new Error("siwx_no_compatible_solana_chain");
  }

  if (options.preferredChainId) {
    const preferredChainId = normalizeSIWxChainId(options.preferredChainId);
    const chain = compatibleChains.find(candidate => candidate.chainId === preferredChainId);
    if (!chain) throw new Error("siwx_preferred_chain_not_supported");
    return { ...chain };
  }

  if (options.supportedChainIds?.length) {
    for (const chainId of options.supportedChainIds.map(normalizeSIWxChainId)) {
      const chain = compatibleChains.find(candidate => candidate.chainId === chainId);
      if (chain) return { ...chain };
    }
    throw new Error("siwx_no_supported_client_chain");
  }

  return { ...compatibleChains[0] };
}

/**
 * Format the canonical Sign-In With Solana message.
 *
 * @param info - Complete SIWX payload fields except the signature
 * @returns Message bytes to sign, represented as a string
 */
export function formatSIWSMessage(info: CompleteSIWxInfo): string {
  const chainReference = extractSolanaChainReference(info.chainId);
  const lines = [`${info.domain} wants you to sign in with your Solana account:`, info.address, ""];

  if (info.statement) {
    lines.push(info.statement, "");
  }

  lines.push(
    `URI: ${info.uri}`,
    `Version: ${info.version}`,
    `Chain ID: ${chainReference}`,
    `Nonce: ${info.nonce}`,
    `Issued At: ${info.issuedAt}`,
  );

  if (info.expirationTime) lines.push(`Expiration Time: ${info.expirationTime}`);
  if (info.notBefore) lines.push(`Not Before: ${info.notBefore}`);
  if (info.requestId) lines.push(`Request ID: ${info.requestId}`);
  if (info.resources?.length) {
    lines.push("Resources:");
    for (const resource of info.resources) {
      lines.push(`- ${resource}`);
    }
  }

  return lines.join("\n");
}

/**
 * Extract the SIWS chain reference from a Solana CAIP-2 identifier.
 *
 * @param chainId - Solana CAIP-2 chain identifier
 * @returns The chain reference portion after `solana:`
 */
export function extractSolanaChainReference(chainId: string): string {
  if (!chainId.startsWith(SOLANA_CHAIN_PREFIX)) {
    throw new Error("siwx_unsupported_chain");
  }
  return chainId.slice(SOLANA_CHAIN_PREFIX.length);
}

/**
 * Create a signed SIWX payload for a selected chain.
 *
 * @param info - Server challenge plus selected chain
 * @param signer - Solana message signer
 * @returns Signed SIWX payload
 */
export async function createSIWxPayload(
  info: Omit<CompleteSIWxInfo, "address">,
  signer: SIWxSigner,
): Promise<SIWxPayload> {
  const address = getSIWxSignerAddress(signer);
  const completeInfo = { ...info, address };
  const message = formatSIWSMessage(completeInfo);
  const signature = await signSolanaMessage(signer, message);

  return {
    ...completeInfo,
    signature,
  };
}

/**
 * Create the SIGN-IN-WITH-X header for a selected SIWX challenge.
 *
 * @param info - Server challenge plus selected chain
 * @param signer - Solana message signer
 * @returns Base64-encoded SIWX header value
 */
export async function createSIWxHeader(
  info: Omit<CompleteSIWxInfo, "address">,
  signer: SIWxSigner,
): Promise<string> {
  return encodeSIWxHeader(await createSIWxPayload(info, signer));
}

/**
 * Create a SIGN-IN-WITH-X header directly from a payment-required response.
 *
 * @param paymentRequired - x402 payment-required response with extensions
 * @param signer - Solana message signer
 * @param options - Optional chain selection preferences
 * @returns Base64-encoded SIWX header value
 */
export async function createSIWxHeaderForChallenge(
  paymentRequired: SIWxPaymentRequired,
  signer: SIWxSigner,
  options: SIWxChainSelectionOptions = {},
): Promise<string> {
  const extension = getSIWxExtension(paymentRequired);
  if (!extension) throw new Error("siwx_extension_missing");
  const chain = selectSIWxChain(extension, options);
  return createSIWxHeader(
    {
      ...extension,
      chainId: chain.chainId,
      type: chain.type,
      signatureScheme: chain.signatureScheme,
    },
    signer,
  );
}

/**
 * Encode a signed SIWX payload for the SIGN-IN-WITH-X header.
 *
 * @param payload - Signed SIWX payload
 * @returns Base64-encoded header value
 */
export function encodeSIWxHeader(payload: SIWxPayload): string {
  return safeBase64Encode(JSON.stringify(payload));
}

/**
 * Decode a SIGN-IN-WITH-X header into a signed SIWX payload.
 *
 * @param header - Base64-encoded SIWX header value
 * @returns Parsed SIWX payload
 */
export function parseSIWxHeader(header: string): SIWxPayload {
  return JSON.parse(safeBase64Decode(header)) as SIWxPayload;
}

/**
 * Verify the Ed25519 signature on a signed SIWX payload.
 *
 * @param payload - Signed SIWX payload
 * @returns Signature verification result
 */
export async function verifySIWxPayload(payload: SIWxPayload): Promise<SIWxValidationResult> {
  if (!isCompatibleSolanaChain(payload)) {
    return { valid: false, error: "siwx_unsupported_chain" };
  }

  try {
    const publicKeyBytes = base58.decode(payload.address);
    const signatureBytes = base58.decode(payload.signature);
    if (publicKeyBytes.length !== 32) return { valid: false, error: "siwx_invalid_address" };
    if (signatureBytes.length !== 64) return { valid: false, error: "siwx_invalid_signature" };

    const subtle = getEd25519SubtleCrypto();
    const key = await subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, [
      "verify",
    ]);
    const verified = await subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      new TextEncoder().encode(formatSIWSMessage(payload)),
    );
    return verified ? { valid: true } : { valid: false, error: "siwx_signature_mismatch" };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "siwx_signature_verification_failed",
    };
  }
}

/**
 * Validate SIWX domain, URI, nonce, and time bounds.
 *
 * @param payload - Signed SIWX payload
 * @param expectedResourceUri - Protected resource URI used for domain and origin checks
 * @param options - Optional validation controls
 * @returns Message validation result
 */
export async function validateSIWxMessage(
  payload: SIWxPayload,
  expectedResourceUri: string,
  options: SIWxMessageValidationOptions = {},
): Promise<SIWxValidationResult> {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  try {
    const expectedUrl = new URL(expectedResourceUri);
    const payloadUrl = new URL(payload.uri);

    if (payload.domain !== expectedUrl.hostname) {
      return { valid: false, error: "siwx_domain_mismatch" };
    }
    if (payloadUrl.origin !== expectedUrl.origin) {
      return { valid: false, error: "siwx_uri_origin_mismatch" };
    }
    if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
      return { valid: false, error: "siwx_nonce_mismatch" };
    }
    if (options.validateNonce && !(await options.validateNonce(payload.nonce))) {
      return { valid: false, error: "siwx_nonce_rejected" };
    }

    const issuedAt = parseDate(payload.issuedAt, "siwx_invalid_issued_at");
    if (issuedAt.getTime() > now.getTime()) {
      return { valid: false, error: "siwx_issued_at_in_future" };
    }
    if (now.getTime() - issuedAt.getTime() > maxAgeMs) {
      return { valid: false, error: "siwx_issued_at_too_old" };
    }
    if (payload.expirationTime) {
      const expirationTime = parseDate(payload.expirationTime, "siwx_invalid_expiration_time");
      if (expirationTime.getTime() <= now.getTime()) {
        return { valid: false, error: "siwx_expired" };
      }
    }
    if (payload.notBefore) {
      const notBefore = parseDate(payload.notBefore, "siwx_invalid_not_before");
      if (notBefore.getTime() > now.getTime()) {
        return { valid: false, error: "siwx_not_before" };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "siwx_validation_failed",
    };
  }
}

/**
 * Return the canonical SIWX header name.
 *
 * @returns Header name used for signed SIWX payloads
 */
export function getSIWxHeaderName(): string {
  return SIGN_IN_WITH_X_HEADER;
}

/**
 * Sign a formatted SIWS message with a supported Solana signer.
 *
 * @param signer - Solana message signer
 * @param message - Formatted SIWS message
 * @returns Base58-encoded message signature
 */
async function signSolanaMessage(signer: SIWxSigner, message: string): Promise<string> {
  const messageBytes = new TextEncoder().encode(message);

  if (isWalletAdapterMessageSigner(signer)) {
    return base58.encode(await signer.signMessage(messageBytes));
  }

  const signatureResponses = await signer.signMessages([{ content: messageBytes, signatures: {} }]);
  const signatures = signatureResponses[0];
  const signature =
    signatures?.[getSIWxSignerAddress(signer)] ?? Object.values(signatures ?? {})[0];
  if (!signature || !(signature instanceof Uint8Array)) throw new Error("siwx_signature_missing");

  return base58.encode(signature);
}

/**
 * Read the base58 address from a supported Solana signer.
 *
 * @param signer - Solana message signer
 * @returns Base58 signer address
 */
function getSIWxSignerAddress(signer: SIWxSigner): string {
  if ("address" in signer && typeof signer.address === "string") {
    return signer.address;
  }

  if (isWalletAdapterMessageSigner(signer)) {
    return signer.publicKey.toBase58?.() ?? signer.publicKey.toString();
  }

  throw new Error("siwx_signer_address_missing");
}

/**
 * Check whether the signer is wallet-adapter-style.
 *
 * @param signer - Solana message signer
 * @returns True when the signer exposes signMessage
 */
function isWalletAdapterMessageSigner(signer: SIWxSigner): signer is WalletAdapterMessageSigner {
  return "signMessage" in signer && typeof signer.signMessage === "function";
}

/**
 * Normalize legacy Solana network names to SIWX CAIP-2 chain identifiers.
 *
 * @param chainId - Chain identifier or legacy network name
 * @returns Solana CAIP-2 chain identifier
 */
function normalizeSIWxChainId(chainId: string): string {
  switch (chainId) {
    case SOLANA_NETWORK:
    case "mainnet":
    case "mainnet-beta":
      return SOLANA_MAINNET_CAIP2;
    case SOLANA_DEVNET_NETWORK:
    case "devnet":
    case "localnet":
      return SOLANA_DEVNET_CAIP2;
    case SOLANA_TESTNET_NETWORK:
    case "testnet":
      return SOLANA_TESTNET_CAIP2;
    default:
      return chainId;
  }
}

/**
 * Check whether a chain entry is a Solana Ed25519 SIWS challenge.
 *
 * @param chain - Chain entry to inspect
 * @returns True when the chain is compatible with this SDK
 */
function isCompatibleSolanaChain(chain: CompatibleChainLike) {
  return (
    chain.chainId.startsWith(SOLANA_CHAIN_PREFIX) &&
    chain.type === "ed25519" &&
    (chain.signatureScheme === undefined || chain.signatureScheme === "siws")
  );
}

/**
 * Check whether an unknown value has the SupportedChain shape.
 *
 * @param value - Unknown value to inspect
 * @returns True when the value is a supported chain
 */
function isSupportedChain(value: unknown): value is SupportedChain {
  if (!isObject(value)) return false;
  return (
    typeof value.chainId === "string" &&
    value.type === "ed25519" &&
    (value.signatureScheme === undefined || value.signatureScheme === "siws")
  );
}

/**
 * Check whether a value is a non-null object.
 *
 * @param value - Unknown value to inspect
 * @returns True when the value is an object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Read a required string field from an unknown object.
 *
 * @param value - Object to inspect
 * @param field - Field name to read
 * @returns String value when present
 */
function getStringField(value: Record<string, unknown>, field: string): string | undefined {
  return typeof value[field] === "string" ? value[field] : undefined;
}

/**
 * Parse a date or throw the caller-provided error.
 *
 * @param value - Date string
 * @param error - Error to throw on invalid input
 * @returns Parsed date
 */
function parseDate(value: string, error: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(error);
  return date;
}

/**
 * Return WebCrypto's Ed25519 verifier.
 *
 * @returns SubtleCrypto verifier with Ed25519 support
 */
function getEd25519SubtleCrypto(): Ed25519SubtleCrypto {
  const cryptoProvider = (globalThis as unknown as { crypto?: { subtle?: Ed25519SubtleCrypto } })
    .crypto;
  if (!cryptoProvider?.subtle) throw new Error("siwx_ed25519_unavailable");
  return cryptoProvider.subtle;
}
