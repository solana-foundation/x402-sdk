export type AdapterKind = "client" | "server";

export const localSolanaInteropCapabilities = ["exact"] as const;

export type InteropScenario = {
  scheme: "exact";
  network: string;
  price: string;
  asset: string;
  resourcePath: string;
  settlementHeader: string;
};

export const supportedInteropCapabilities = ["exact"] as const;

export const unsupportedReadinessCapabilities = ["batch-settlement", "session"] as const;

export type ReadyMessage = {
  type: "ready";
  implementation: string;
  role: AdapterKind;
  port?: number;
  capabilities?: readonly string[];
};

export type ClientRunResult = {
  type: "result";
  implementation: string;
  role: "client";
  ok: boolean;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  settlement?: unknown;
  // The encoded x402 payment header (PAYMENT-SIGNATURE for v2, X-PAYMENT
  // for v1) that the client actually sent on the second/paid request.
  // Captured so cross-server-portability and idempotent-resubmit scenarios
  // can replay the exact credential. Optional because not every adapter
  // exposes it yet; TypeScript reference adapter always sets it.
  paymentHeader?: string | null;
};

export type AdapterMessage = ReadyMessage | ClientRunResult;

export const interopScenario: InteropScenario = {
  scheme: "exact",
  network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  price: "$0.001",
  asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  resourcePath: "/protected",
  settlementHeader: "x-fixture-settlement",
};
