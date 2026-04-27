/**
 * @module @solana/x402
 *
 * Solana implementation of the x402 payment protocol.
 */

export * as client from "./client";
export * as facilitator from "./facilitator";
export * as protocol from "./protocol";
export * as server from "./server";
export * as siwx from "./siwx";
export * as v1 from "./v1";

export * from "./constants";
export { ExactSvmScheme, registerExactSvmScheme } from "./client/exact";
export {
  ExactSvmScheme as ExactClientScheme,
  registerExactSvmScheme as registerExactClientScheme,
} from "./client/exact";
export {
  ExactSvmScheme as ExactFacilitatorScheme,
  registerExactSvmScheme as registerExactFacilitatorScheme,
} from "./facilitator/exact";
export {
  ExactSvmScheme as ExactServerScheme,
  registerExactSvmScheme as registerExactServerScheme,
} from "./server/exact";

export { toClientSvmSigner, toFacilitatorSvmSigner } from "./signer";
export type {
  ClientSvmSigner,
  FacilitatorSvmSigner,
  FacilitatorRpcClient,
  FacilitatorRpcConfig,
  ClientSvmConfig,
} from "./signer";

export type { ExactSvmPayloadV1, ExactSvmPayloadV2 } from "./protocol/schemes/exact/types";
export * from "./protocol/schemes/exact";

export { SettlementCache } from "./settlement-cache";
export * from "./siwx";
export * from "./utils";
