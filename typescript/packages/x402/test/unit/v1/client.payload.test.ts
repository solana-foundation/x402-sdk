import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRpcClientMock: vi.fn(),
  fetchMintMock: vi.fn(),
  findAssociatedTokenPdaMock: vi.fn(),
  getTransferCheckedInstructionMock: vi.fn(),
  createTransactionMessageMock: vi.fn(),
  setTransactionMessageComputeUnitPriceMock: vi.fn(),
  setTransactionMessageFeePayerMock: vi.fn(),
  prependTransactionMessageInstructionMock: vi.fn(),
  appendTransactionMessageInstructionsMock: vi.fn(),
  setTransactionMessageLifetimeUsingBlockhashMock: vi.fn(),
  partiallySignTransactionMessageWithSignersMock: vi.fn(),
  getBase64EncodedWireTransactionMock: vi.fn(),
}));

vi.mock("../../../src/utils", async () => {
  const actual = await vi.importActual<typeof import("../../../src/utils")>("../../../src/utils");
  return {
    ...actual,
    createRpcClient: mocks.createRpcClientMock,
  };
});

vi.mock("@solana-program/token-2022", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/token-2022")>(
    "@solana-program/token-2022",
  );
  return {
    ...actual,
    fetchMint: mocks.fetchMintMock,
    findAssociatedTokenPda: mocks.findAssociatedTokenPdaMock,
    getTransferCheckedInstruction: mocks.getTransferCheckedInstructionMock,
  };
});

vi.mock("@solana/kit", async () => {
  const actual = await vi.importActual<typeof import("@solana/kit")>("@solana/kit");
  return {
    ...actual,
    createTransactionMessage: mocks.createTransactionMessageMock,
    setTransactionMessageComputeUnitPrice: mocks.setTransactionMessageComputeUnitPriceMock,
    setTransactionMessageFeePayer: mocks.setTransactionMessageFeePayerMock,
    prependTransactionMessageInstruction: mocks.prependTransactionMessageInstructionMock,
    appendTransactionMessageInstructions: mocks.appendTransactionMessageInstructionsMock,
    setTransactionMessageLifetimeUsingBlockhash:
      mocks.setTransactionMessageLifetimeUsingBlockhashMock,
    partiallySignTransactionMessageWithSigners:
      mocks.partiallySignTransactionMessageWithSignersMock,
    getBase64EncodedWireTransaction: mocks.getBase64EncodedWireTransactionMock,
  };
});

import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { ExactSvmSchemeV1 } from "../../../src/v1/exact";
import { USDC_DEVNET_ADDRESS } from "../../../src/protocol/schemes/exact";

const feePayer = "FeePayer1111111111111111111111111111";

describe("ExactSvmSchemeV1.createPaymentPayload", () => {
  const mockSigner = {
    address: "Payer11111111111111111111111111111111",
    signTransactions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRpcClientMock.mockReturnValue({
      getLatestBlockhash: vi.fn(() => ({
        send: vi.fn().mockResolvedValue({
          value: {
            blockhash: "blockhash",
          },
        }),
      })),
    });
    mocks.fetchMintMock.mockResolvedValue({
      programAddress: TOKEN_PROGRAM_ADDRESS,
      data: { decimals: 6 },
    });
    mocks.findAssociatedTokenPdaMock
      .mockResolvedValueOnce(["source-ata"])
      .mockResolvedValueOnce(["destination-ata"]);
    mocks.getTransferCheckedInstructionMock.mockReturnValue({
      instruction: "transfer",
    });
    mocks.createTransactionMessageMock.mockReturnValue({
      version: 0,
      instructions: [],
    });
    mocks.setTransactionMessageComputeUnitPriceMock.mockImplementation(
      (_: unknown, tx: unknown) => tx,
    );
    mocks.setTransactionMessageFeePayerMock.mockImplementation((_: unknown, tx: unknown) => tx);
    mocks.prependTransactionMessageInstructionMock.mockImplementation(
      (_: unknown, tx: unknown) => tx,
    );
    mocks.appendTransactionMessageInstructionsMock.mockImplementation(
      (_: unknown, tx: unknown) => tx,
    );
    mocks.setTransactionMessageLifetimeUsingBlockhashMock.mockImplementation(
      (_: unknown, tx: unknown) => tx,
    );
    mocks.partiallySignTransactionMessageWithSignersMock.mockResolvedValue({
      signatures: {},
      messageBytes: new Uint8Array([1, 2, 3]),
    });
    mocks.getBase64EncodedWireTransactionMock.mockReturnValue("signed-base64");
  });

  it("builds a V1 payment payload", async () => {
    const client = new ExactSvmSchemeV1(mockSigner as never);
    const result = await client.createPaymentPayload(1, {
      scheme: "exact",
      network: "solana-devnet",
      asset: USDC_DEVNET_ADDRESS,
      maxAmountRequired: "100000",
      payTo: "PayToAddress11111111111111111111111111",
      maxTimeoutSeconds: 60,
      extra: { feePayer },
    } as never);

    expect(result).toEqual({
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
      payload: {
        transaction: "signed-base64",
      },
    });
    expect(mocks.findAssociatedTokenPdaMock).toHaveBeenCalledTimes(2);
    expect(mocks.getTransferCheckedInstructionMock).toHaveBeenCalled();
  });

  it("throws when feePayer is missing", async () => {
    const client = new ExactSvmSchemeV1(mockSigner as never);

    await expect(
      client.createPaymentPayload(1, {
        scheme: "exact",
        network: "solana-devnet",
        asset: USDC_DEVNET_ADDRESS,
        maxAmountRequired: "100000",
        payTo: "PayToAddress11111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: {},
      } as never),
    ).rejects.toThrow("feePayer is required in paymentRequirements.extra for SVM transactions");
  });

  it("throws when the mint program is unknown", async () => {
    mocks.fetchMintMock.mockResolvedValue({
      programAddress: { toString: () => "UnknownProgram1111111111111111111111111" },
      data: { decimals: 6 },
    });
    const client = new ExactSvmSchemeV1(mockSigner as never);

    await expect(
      client.createPaymentPayload(1, {
        scheme: "exact",
        network: "solana-devnet",
        asset: USDC_DEVNET_ADDRESS,
        maxAmountRequired: "100000",
        payTo: "PayToAddress11111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: { feePayer },
      } as never),
    ).rejects.toThrow("Asset was not created by a known token program");
  });
});
