import {
  decompileTransactionMessage,
  getBase64Encoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  type Transaction,
  createSolanaRpc,
  devnet,
  testnet,
  mainnet,
  type RpcDevnet,
  type SolanaRpcApiDevnet,
  type RpcTestnet,
  type SolanaRpcApiTestnet,
  type RpcMainnet,
  type SolanaRpcApiMainnet,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import type { Network } from "@x402/core/types";
import {
  SVM_ADDRESS_REGEX,
  DEVNET_RPC_URL,
  TESTNET_RPC_URL,
  MAINNET_RPC_URL,
  USDC_MAINNET_ADDRESS,
  USDC_DEVNET_ADDRESS,
  USDC_TESTNET_ADDRESS,
  USDT_MAINNET_ADDRESS,
  USDG_MAINNET_ADDRESS,
  USDG_DEVNET_ADDRESS,
  USDG_TESTNET_ADDRESS,
  PYUSD_MAINNET_ADDRESS,
  PYUSD_DEVNET_ADDRESS,
  PYUSD_TESTNET_ADDRESS,
  CASH_MAINNET_ADDRESS,
  SOLANA_MAINNET_CAIP2,
  SOLANA_DEVNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
  V1_TO_V2_NETWORK_MAP,
  STABLECOIN_MINTS,
  STABLECOIN_TOKEN_PROGRAMS,
} from "./protocol/schemes/exact/constants";
import type { ExactSvmPayloadV1 } from "./protocol/schemes/exact/types";

/**
 * Normalize network identifier to CAIP-2 format
 * Handles both V1 names (solana, solana-devnet) and V2 CAIP-2 format
 *
 * @param network - Network identifier (V1 or V2 format)
 * @returns CAIP-2 network identifier
 */
export function normalizeNetwork(network: Network): string {
  // If it's already CAIP-2 format (contains ":"), validate it's supported
  if (network.includes(":")) {
    const supported = [SOLANA_MAINNET_CAIP2, SOLANA_DEVNET_CAIP2, SOLANA_TESTNET_CAIP2];
    if (!supported.includes(network)) {
      throw new Error(`Unsupported SVM network: ${network}`);
    }
    return network;
  }

  // Otherwise, it's a V1 network name, convert to CAIP-2
  const caip2Network = V1_TO_V2_NETWORK_MAP[network];
  if (!caip2Network) {
    throw new Error(`Unsupported SVM network: ${network}`);
  }
  return caip2Network;
}

/**
 * Validate Solana address format
 *
 * @param address - Base58 encoded address string
 * @returns true if address is valid, false otherwise
 */
export function validateSvmAddress(address: string): boolean {
  return SVM_ADDRESS_REGEX.test(address);
}

/**
 * Decode a base64 encoded transaction from an SVM payload
 *
 * @param svmPayload - The SVM payload containing a base64 encoded transaction
 * @returns Decoded Transaction object
 */
export function decodeTransactionFromPayload(svmPayload: ExactSvmPayloadV1): Transaction {
  try {
    const base64Encoder = getBase64Encoder();
    const transactionBytes = base64Encoder.encode(svmPayload.transaction);
    const transactionDecoder = getTransactionDecoder();
    return transactionDecoder.decode(transactionBytes);
  } catch {
    throw new Error("invalid_exact_svm_payload_transaction");
  }
}

/**
 * Extract the token sender (owner of the source token account) from a TransferChecked instruction
 *
 * @param transaction - The decoded transaction
 * @returns The token payer address as a base58 string
 */
export function getTokenPayerFromTransaction(transaction: Transaction): string {
  const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  const decompiled = decompileTransactionMessage(compiled);
  const instructions = decompiled.instructions ?? [];

  for (const ix of instructions) {
    const programAddress = ix.programAddress.toString();

    // Check if this is a token program instruction
    if (
      programAddress === TOKEN_PROGRAM_ADDRESS.toString() ||
      programAddress === TOKEN_2022_PROGRAM_ADDRESS.toString()
    ) {
      const accounts = ix.accounts ?? [];
      // TransferChecked account order: [source, mint, destination, owner, ...]
      if (accounts.length >= 4) {
        const ownerAddress = accounts[3]?.address?.toString() ?? "";
        if (ownerAddress) return ownerAddress;
      }
    }
  }

  return "";
}

/**
 * Create an RPC client for the specified network
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @param customRpcUrl - Optional custom RPC URL
 * @returns RPC client for the specified network
 */
export function createRpcClient(
  network: Network,
  customRpcUrl?: string,
):
  | RpcDevnet<SolanaRpcApiDevnet>
  | RpcTestnet<SolanaRpcApiTestnet>
  | RpcMainnet<SolanaRpcApiMainnet> {
  const caip2Network = normalizeNetwork(network);

  switch (caip2Network) {
    case SOLANA_DEVNET_CAIP2: {
      const url = customRpcUrl || DEVNET_RPC_URL;
      return createSolanaRpc(devnet(url)) as RpcDevnet<SolanaRpcApiDevnet>;
    }
    case SOLANA_TESTNET_CAIP2: {
      const url = customRpcUrl || TESTNET_RPC_URL;
      return createSolanaRpc(testnet(url)) as RpcTestnet<SolanaRpcApiTestnet>;
    }
    case SOLANA_MAINNET_CAIP2: {
      const url = customRpcUrl || MAINNET_RPC_URL;
      return createSolanaRpc(mainnet(url)) as RpcMainnet<SolanaRpcApiMainnet>;
    }
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

/**
 * Get the default USDC mint address for a network
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns USDC mint address for the network
 */
export function getUsdcAddress(network: Network): string {
  const caip2Network = normalizeNetwork(network);

  switch (caip2Network) {
    case SOLANA_MAINNET_CAIP2:
      return USDC_MAINNET_ADDRESS;
    case SOLANA_DEVNET_CAIP2:
      return USDC_DEVNET_ADDRESS;
    case SOLANA_TESTNET_CAIP2:
      return USDC_TESTNET_ADDRESS;
    default:
      throw new Error(`No USDC address configured for network: ${network}`);
  }
}

/**
 * Get the official USDT mint address for a supported network.
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns USDT mint address for the network
 */
export function getUsdtAddress(network: Network): string {
  const caip2Network = normalizeNetwork(network);

  if (caip2Network === SOLANA_MAINNET_CAIP2) {
    return USDT_MAINNET_ADDRESS;
  }

  throw new Error(`No USDT address configured for network: ${network}`);
}

/**
 * Get the official USDG mint address for a supported network.
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns USDG mint address for the network
 */
export function getUsdgAddress(network: Network): string {
  const caip2Network = normalizeNetwork(network);

  switch (caip2Network) {
    case SOLANA_MAINNET_CAIP2:
      return USDG_MAINNET_ADDRESS;
    case SOLANA_DEVNET_CAIP2:
      return USDG_DEVNET_ADDRESS;
    case SOLANA_TESTNET_CAIP2:
      return USDG_TESTNET_ADDRESS;
    default:
      throw new Error(`No USDG address configured for network: ${network}`);
  }
}

/**
 * Get the official PYUSD mint address for a supported network.
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns PYUSD mint address for the network
 */
export function getPyusdAddress(network: Network): string {
  const caip2Network = normalizeNetwork(network);

  switch (caip2Network) {
    case SOLANA_MAINNET_CAIP2:
      return PYUSD_MAINNET_ADDRESS;
    case SOLANA_DEVNET_CAIP2:
      return PYUSD_DEVNET_ADDRESS;
    case SOLANA_TESTNET_CAIP2:
      return PYUSD_TESTNET_ADDRESS;
    default:
      throw new Error(`No PYUSD address configured for network: ${network}`);
  }
}

/**
 * Get the official Phantom CASH mint address for a supported network.
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns CASH mint address for the network
 */
export function getCashAddress(network: Network): string {
  const caip2Network = normalizeNetwork(network);

  if (caip2Network === SOLANA_MAINNET_CAIP2) {
    return CASH_MAINNET_ADDRESS;
  }

  throw new Error(`No CASH address configured for network: ${network}`);
}

/**
 * Resolve a supported stablecoin symbol to its mint address.
 *
 * @param symbol - Stablecoin symbol, currently USDC/USD, USDT, USDG, PYUSD, or CASH
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns Stablecoin mint address for the network
 */
export function getStablecoinAddress(symbol: string, network: Network): string {
  const caip2Network = normalizeNetwork(network);
  const normalizedSymbol = symbol.toUpperCase() === "USD" ? "USDC" : symbol.toUpperCase();
  const mintByNetwork =
    STABLECOIN_MINTS[normalizedSymbol as keyof typeof STABLECOIN_MINTS] ?? undefined;
  const mint = mintByNetwork?.[caip2Network as keyof typeof mintByNetwork];

  if (!mint) {
    throw new Error(`No ${normalizedSymbol} address configured for network: ${network}`);
  }

  return mint;
}

/**
 * Return the supported stablecoin symbol for a symbol or known mint address.
 *
 * @param currency - Stablecoin symbol or mint address
 * @returns Stablecoin symbol when recognized
 */
export function getStablecoinSymbol(currency: string): keyof typeof STABLECOIN_MINTS | undefined {
  const normalizedSymbol = currency.toUpperCase() === "USD" ? "USDC" : currency.toUpperCase();
  if (normalizedSymbol in STABLECOIN_MINTS) {
    return normalizedSymbol as keyof typeof STABLECOIN_MINTS;
  }

  for (const [symbol, mintByNetwork] of Object.entries(STABLECOIN_MINTS)) {
    if (Object.values(mintByNetwork).some(mint => mint === currency)) {
      return symbol as keyof typeof STABLECOIN_MINTS;
    }
  }
}

/**
 * Return the known token program for a supported stablecoin symbol or mint address.
 *
 * @param currency - Stablecoin symbol or mint address
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns SPL Token or Token-2022 program address
 */
export function getStablecoinTokenProgram(currency: string, network: Network): string {
  let symbol = getStablecoinSymbol(currency);
  if (!symbol) {
    try {
      symbol = getStablecoinSymbol(getStablecoinAddress(currency, network));
    } catch {
      symbol = undefined;
    }
  }
  return symbol ? STABLECOIN_TOKEN_PROGRAMS[symbol] : TOKEN_PROGRAM_ADDRESS.toString();
}

/**
 * Convert a decimal amount to token smallest units
 *
 * @param decimalAmount - The decimal amount (e.g., "0.10")
 * @param decimals - The number of decimals for the token (e.g., 6 for USDC)
 * @returns The amount in smallest units as a string
 */
export function convertToTokenAmount(decimalAmount: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  const amount = decimalAmount.trim();
  if (!/^\d+(?:\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }

  const [intPart, decPart = ""] = amount.split(".");
  if (decPart.length > decimals) {
    throw new Error(`Invalid amount precision: ${decimalAmount}`);
  }

  const paddedDec = decPart.padEnd(decimals, "0");
  return BigInt(`${intPart}${paddedDec}`).toString();
}
