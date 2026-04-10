import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@solana/kit";

const mocks = vi.hoisted(() => ({
  createRpcClientMock: vi.fn(),
  decodeTransactionFromPayloadMock: vi.fn(),
  getBase64EncodedWireTransactionMock: vi.fn(),
  fetchMintMock: vi.fn(),
}));

vi.mock("../../src/utils", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils")>("../../src/utils");
  return {
    ...actual,
    createRpcClient: mocks.createRpcClientMock,
    decodeTransactionFromPayload: mocks.decodeTransactionFromPayloadMock,
  };
});

vi.mock("@solana/kit", async () => {
  const actual = await vi.importActual<typeof import("@solana/kit")>("@solana/kit");
  return {
    ...actual,
    getBase64EncodedWireTransaction: mocks.getBase64EncodedWireTransactionMock,
  };
});

vi.mock("@solana-program/token-2022", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/token-2022")>(
    "@solana-program/token-2022",
  );
  return {
    ...actual,
    fetchMint: mocks.fetchMintMock,
  };
});

import { createRpcCapabilitiesFromRpc, toFacilitatorSvmSigner } from "../../src/signer";
import { SOLANA_DEVNET_CAIP2 } from "../../src/protocol/schemes/exact";

function createRpcMock() {
  return {
    getBalance: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({ value: BigInt(42) }),
    })),
    getAccountInfo: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({
        value: {
          data: {
            parsed: { info: { tokenAmount: { amount: "123" } } },
          },
        },
      }),
    })),
    getLatestBlockhash: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({
        value: {
          blockhash: "blockhash",
          lastValidBlockHeight: BigInt(99),
        },
      }),
    })),
    simulateTransaction: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({ value: { err: null } }),
    })),
    sendTransaction: vi.fn(() => ({
      send: vi.fn().mockResolvedValue("signature-123"),
    })),
    getSignatureStatuses: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({
        value: [{ confirmationStatus: "finalized" }],
      }),
    })),
    getSlot: vi.fn(),
  };
}

describe("signer capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates RPC capabilities from a Solana RPC client", async () => {
    const rpc = createRpcMock();
    const capabilities = createRpcCapabilitiesFromRpc(rpc as never);

    await expect(capabilities.getBalance("payer")).resolves.toBe(BigInt(42));
    await expect(capabilities.getTokenAccountBalance("token-account")).resolves.toBe(BigInt(123));
    await expect(capabilities.getLatestBlockhash()).resolves.toEqual({
      blockhash: "blockhash",
      lastValidBlockHeight: BigInt(99),
    });
    await expect(capabilities.simulateTransaction("tx", { foo: "bar" })).resolves.toEqual({
      value: { err: null },
    });
    await expect(capabilities.sendTransaction("tx")).resolves.toBe("signature-123");
  });

  it("throws when a token account is missing", async () => {
    const rpc = createRpcMock();
    rpc.getAccountInfo.mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: null }),
    });
    const capabilities = createRpcCapabilitiesFromRpc(rpc as never);

    await expect(capabilities.getTokenAccountBalance("missing")).rejects.toThrow(
      "Token account not found: missing",
    );
  });

  it("confirms transactions and times out when confirmation never arrives", async () => {
    const confirmedRpc = createRpcMock();
    const confirmedCapabilities = createRpcCapabilitiesFromRpc(confirmedRpc as never);
    await expect(confirmedCapabilities.confirmTransaction("sig")).resolves.toEqual({
      confirmationStatus: "finalized",
    });

    const slowRpc = createRpcMock();
    slowRpc.getSignatureStatuses.mockReturnValue({
      send: vi.fn().mockResolvedValue({
        value: [{ confirmationStatus: "processed" }],
      }),
    });
    const slowCapabilities = createRpcCapabilitiesFromRpc(slowRpc as never);

    vi.useFakeTimers();
    const confirmation = slowCapabilities
      .confirmTransaction("sig-timeout")
      .catch(error => error as Error);
    await vi.advanceTimersByTimeAsync(30_000);
    const error = await confirmation;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Transaction confirmation timeout");
  });

  it("fetches mint data through the token-2022 helper", async () => {
    const rpc = createRpcMock();
    mocks.fetchMintMock.mockResolvedValue({ decimals: 6 });
    const capabilities = createRpcCapabilitiesFromRpc(rpc as never);

    await expect(capabilities.fetchMint("mint-address")).resolves.toEqual({ decimals: 6 });
    expect(mocks.fetchMintMock).toHaveBeenCalledWith(rpc, "mint-address");
  });

  it("signs, simulates, sends, and confirms through a facilitator signer", async () => {
    const rpc = createRpcMock();
    const signer = {
      address: "FeePayer1111111111111111111111111111" as Address,
      signMessages: vi.fn().mockResolvedValue([{ extraSig: new Uint8Array([9, 9]) }]),
      signTransactions: vi.fn(),
    };

    mocks.decodeTransactionFromPayloadMock.mockReturnValue({
      messageBytes: new Uint8Array([1, 2, 3]),
      signatures: { existingSig: new Uint8Array([4, 5]) },
    });
    mocks.getBase64EncodedWireTransactionMock.mockReturnValue("fully-signed-tx");

    const facilitator = toFacilitatorSvmSigner(signer as never, rpc as never);

    await expect(
      facilitator.signTransaction("partial-tx", signer.address, SOLANA_DEVNET_CAIP2),
    ).resolves.toBe("fully-signed-tx");
    expect(signer.signMessages).toHaveBeenCalledWith([
      {
        content: new Uint8Array([1, 2, 3]),
        signatures: { existingSig: new Uint8Array([4, 5]) },
      },
    ]);
    expect(mocks.getBase64EncodedWireTransactionMock).toHaveBeenCalled();

    await expect(facilitator.simulateTransaction("tx", SOLANA_DEVNET_CAIP2)).resolves.toBe(
      undefined,
    );
    await expect(facilitator.sendTransaction("tx", SOLANA_DEVNET_CAIP2)).resolves.toBe(
      "signature-123",
    );
    await expect(
      facilitator.confirmTransaction("signature-123", SOLANA_DEVNET_CAIP2),
    ).resolves.toBeUndefined();
  });

  it("uses exact-match RPCs before wildcard and default RPC creation", async () => {
    const explicitRpc = createRpcMock();
    const wildcardRpc = createRpcMock();
    const defaultRpc = createRpcMock();
    const signer = {
      address: "FeePayer1111111111111111111111111111" as Address,
      signMessages: vi.fn().mockResolvedValue([{}]),
      signTransactions: vi.fn(),
    };

    mocks.createRpcClientMock.mockReturnValue(defaultRpc);

    const explicitFacilitator = toFacilitatorSvmSigner(
      signer as never,
      {
        [SOLANA_DEVNET_CAIP2]: explicitRpc,
      } as never,
    );
    await explicitFacilitator.sendTransaction("tx-explicit", SOLANA_DEVNET_CAIP2);
    expect(explicitRpc.sendTransaction).toHaveBeenCalled();
    expect(mocks.createRpcClientMock).not.toHaveBeenCalled();

    const wildcardFacilitator = toFacilitatorSvmSigner(signer as never, wildcardRpc as never);
    await wildcardFacilitator.sendTransaction("tx-wildcard", SOLANA_DEVNET_CAIP2);
    expect(wildcardRpc.sendTransaction).toHaveBeenCalled();

    const defaultFacilitator = toFacilitatorSvmSigner(signer as never, {
      defaultRpcUrl: "https://rpc.example",
    });
    await defaultFacilitator.sendTransaction("tx-default", SOLANA_DEVNET_CAIP2);
    expect(mocks.createRpcClientMock).toHaveBeenCalledWith(
      SOLANA_DEVNET_CAIP2,
      "https://rpc.example",
    );
  });
});
