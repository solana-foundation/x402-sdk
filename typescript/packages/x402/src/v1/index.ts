/**
 * V1 exports for the SVM mechanism
 */
import { SOLANA_DEVNET_NETWORK, SOLANA_NETWORK, SOLANA_TESTNET_NETWORK } from "../constants";

export * from "./exact";

export const NETWORKS: string[] = [SOLANA_NETWORK, SOLANA_DEVNET_NETWORK, SOLANA_TESTNET_NETWORK];
