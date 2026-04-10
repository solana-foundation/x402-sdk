import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  decodeThrows: false,
  payer: "Payer11111111111111111111111111111111",
  instructions: [] as Array<{ programAddress: { toString(): string }; data?: Uint8Array }>,
  transferThrows: false,
  associatedTokenThrows: false,
  expectedDestinationAta: "DestinationAta111111111111111111111111",
  parsedAmount: BigInt(100000),
  mintAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  authorityAddress: "Payer11111111111111111111111111111111",
  computeLimitThrows: false,
  computePriceThrows: false,
  microLamports: BigInt(1),
}));

vi.mock("@solana/kit", async () => {
  const actual = await vi.importActual<typeof import("@solana/kit")>("@solana/kit");
  return {
    ...actual,
    getCompiledTransactionMessageDecoder: () => ({
      decode: () => ({}),
    }),
    decompileTransactionMessage: () => ({
      instructions: mockState.instructions,
    }),
  };
});

vi.mock("@solana-program/compute-budget", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/compute-budget")>(
    "@solana-program/compute-budget",
  );
  return {
    ...actual,
    parseSetComputeUnitLimitInstruction: () => {
      if (mockState.computeLimitThrows) {
        throw new Error("bad-limit");
      }
      return {};
    },
    parseSetComputeUnitPriceInstruction: () => {
      if (mockState.computePriceThrows) {
        throw new Error("bad-price");
      }
      return { microLamports: mockState.microLamports };
    },
  };
});

vi.mock("@solana-program/token", async () => {
  const actual =
    await vi.importActual<typeof import("@solana-program/token")>("@solana-program/token");
  return {
    ...actual,
    parseTransferCheckedInstruction: () => {
      if (mockState.transferThrows) {
        throw new Error("bad-transfer");
      }
      return {
        accounts: {
          authority: { address: { toString: () => mockState.authorityAddress } },
          mint: { address: { toString: () => mockState.mintAddress } },
          destination: {
            address: { toString: () => "DestinationAta111111111111111111111111" },
          },
        },
        data: { amount: mockState.parsedAmount },
      };
    },
  };
});

vi.mock("@solana-program/token-2022", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/token-2022")>(
    "@solana-program/token-2022",
  );
  return {
    ...actual,
    parseTransferCheckedInstruction: () => {
      if (mockState.transferThrows) {
        throw new Error("bad-transfer");
      }
      return {
        accounts: {
          authority: { address: { toString: () => mockState.authorityAddress } },
          mint: { address: { toString: () => mockState.mintAddress } },
          destination: {
            address: { toString: () => "DestinationAta111111111111111111111111" },
          },
        },
        data: { amount: mockState.parsedAmount },
      };
    },
    findAssociatedTokenPda: async () => {
      if (mockState.associatedTokenThrows) {
        throw new Error("ata failed");
      }
      return [{ toString: () => mockState.expectedDestinationAta }];
    },
  };
});

vi.mock("../../src/utils", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils")>("../../src/utils");
  return {
    ...actual,
    decodeTransactionFromPayload: () => {
      if (mockState.decodeThrows) {
        throw new Error("decode failed");
      }
      return {
        messageBytes: new Uint8Array([1, 2, 3]),
        signatures: {},
      };
    },
    getTokenPayerFromTransaction: () => mockState.payer,
  };
});

import * as computeBudget from "@solana-program/compute-budget";
import * as token from "@solana-program/token";
import { ExactSvmScheme } from "../../src/facilitator/exact/scheme";
import { ExactSvmSchemeV1 } from "../../src/v1/exact/facilitator/scheme";
import { SettlementCache } from "../../src/settlement-cache";
import {
  MEMO_PROGRAM_ADDRESS,
  SOLANA_DEVNET_CAIP2,
  USDC_DEVNET_ADDRESS,
} from "../../src/protocol/schemes/exact";

const feePayer = "FeePayer1111111111111111111111111111";
const facilitatorAddress = "FacilitatorAddress1111111111111111111";
const payer = "Payer11111111111111111111111111111111";
const payTo = "PayToAddress11111111111111111111111111";
const destinationAta = "DestinationAta111111111111111111111111";

function programAddress(value: string) {
  return { toString: () => value };
}

function createInstructions(transferProgram: string, optionalPrograms: string[] = []) {
  return [
    {
      programAddress: programAddress(computeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS.toString()),
      data: new Uint8Array([2]),
    },
    {
      programAddress: programAddress(computeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS.toString()),
      data: new Uint8Array([3]),
    },
    {
      programAddress: programAddress(transferProgram),
      data: new Uint8Array([12]),
    },
    ...optionalPrograms.map(program => ({
      programAddress: programAddress(program),
      data: new Uint8Array([1]),
    })),
  ];
}

function createSigner() {
  return {
    getAddresses: vi.fn().mockReturnValue([feePayer, facilitatorAddress]),
    signTransaction: vi.fn().mockResolvedValue("fully-signed"),
    simulateTransaction: vi.fn().mockResolvedValue(undefined),
    sendTransaction: vi.fn().mockResolvedValue("signature-123"),
    confirmTransaction: vi.fn().mockResolvedValue(undefined),
  };
}

function createV2Payload(transaction = "tx-1") {
  return {
    x402Version: 2,
    resource: {
      url: "http://example.com",
      description: "resource",
      mimeType: "application/json",
    },
    accepted: {
      scheme: "exact",
      network: SOLANA_DEVNET_CAIP2,
      asset: USDC_DEVNET_ADDRESS,
      amount: "100000",
      payTo,
      maxTimeoutSeconds: 60,
      extra: { feePayer },
    },
    payload: { transaction },
  };
}

function createV2Requirements() {
  return {
    scheme: "exact",
    network: SOLANA_DEVNET_CAIP2,
    asset: USDC_DEVNET_ADDRESS,
    amount: "100000",
    payTo,
    maxTimeoutSeconds: 60,
    extra: { feePayer },
  };
}

function createV1Payload(transaction = "tx-1") {
  return {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: { transaction },
  };
}

function createV1Requirements() {
  return {
    scheme: "exact",
    network: "solana-devnet",
    asset: USDC_DEVNET_ADDRESS,
    maxAmountRequired: "100000",
    payTo,
    maxTimeoutSeconds: 60,
    extra: { feePayer },
  };
}

beforeEach(() => {
  Object.assign(mockState, {
    decodeThrows: false,
    payer,
    instructions: createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString()),
    transferThrows: false,
    associatedTokenThrows: false,
    expectedDestinationAta: destinationAta,
    parsedAmount: BigInt(100000),
    mintAddress: USDC_DEVNET_ADDRESS,
    authorityAddress: payer,
    computeLimitThrows: false,
    computePriceThrows: false,
    microLamports: BigInt(1),
  });
});

describe("facilitator branch matrix", () => {
  async function expectInvalidV2(
    mutate: (signer: ReturnType<typeof createSigner>) => void,
    invalidReason: string,
  ) {
    const signer = createSigner();
    mutate(signer);
    const facilitator = new ExactSvmScheme(signer as never);
    const result = await facilitator.verify(
      createV2Payload() as never,
      createV2Requirements() as never,
    );
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe(invalidReason);
  }

  async function expectInvalidV1(
    mutate: (signer: ReturnType<typeof createSigner>) => void,
    invalidReason: string,
  ) {
    const signer = createSigner();
    mutate(signer);
    const facilitator = new ExactSvmSchemeV1(signer as never);
    const result = await facilitator.verify(
      createV1Payload() as never,
      createV1Requirements() as never,
    );
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe(invalidReason);
  }

  it("exposes extra data and signer lists", () => {
    const signer = createSigner();
    const v2 = new ExactSvmScheme(signer as never);
    const v1 = new ExactSvmSchemeV1(signer as never);

    expect([feePayer, facilitatorAddress]).toContain(
      v2.getExtra(SOLANA_DEVNET_CAIP2)?.feePayer as string,
    );
    expect(v2.getSigners(SOLANA_DEVNET_CAIP2)).toEqual([feePayer, facilitatorAddress]);
    expect([feePayer, facilitatorAddress]).toContain(
      v1.getExtra("solana-devnet")?.feePayer as string,
    );
    expect(v1.getSigners("solana-devnet")).toEqual([feePayer, facilitatorAddress]);
  });

  it("covers common verify failure branches for V2 and V1", async () => {
    await expectInvalidV2(
      signer => signer.getAddresses.mockReturnValue([facilitatorAddress]),
      "fee_payer_not_managed_by_facilitator",
    );
    await expectInvalidV1(
      signer => signer.getAddresses.mockReturnValue([facilitatorAddress]),
      "fee_payer_not_managed_by_facilitator",
    );

    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString()).slice(0, 2);
    await expectInvalidV2(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_length",
    );
    await expectInvalidV1(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_length",
    );

    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString());
    mockState.computeLimitThrows = true;
    await expectInvalidV2(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction",
    );
    await expectInvalidV1(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction",
    );

    mockState.computeLimitThrows = false;
    mockState.computePriceThrows = true;
    await expectInvalidV2(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction",
    );
    await expectInvalidV1(
      () => undefined,
      "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction",
    );

    mockState.computePriceThrows = false;
    mockState.payer = "";
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");

    mockState.payer = payer;
    mockState.instructions = createInstructions("unknown-program");
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");

    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString());
    mockState.transferThrows = true;
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_no_transfer_instruction");

    mockState.transferThrows = false;
    mockState.authorityAddress = feePayer;
    await expectInvalidV2(
      () => undefined,
      "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
    );
    await expectInvalidV1(
      () => undefined,
      "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
    );

    mockState.authorityAddress = payer;
    mockState.mintAddress = "WrongMint111111111111111111111111111111";
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_mint_mismatch");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_mint_mismatch");

    mockState.mintAddress = USDC_DEVNET_ADDRESS;
    mockState.expectedDestinationAta = "OtherAta111111111111111111111111111111";
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_recipient_mismatch");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_recipient_mismatch");

    mockState.expectedDestinationAta = destinationAta;
    mockState.associatedTokenThrows = true;
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_recipient_mismatch");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_recipient_mismatch");

    mockState.associatedTokenThrows = false;
    mockState.parsedAmount = BigInt(999);
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_amount_mismatch");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_amount_mismatch");

    mockState.parsedAmount = BigInt(100000);
    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString(), [
      "UnknownFourth11111111111111111111111111111",
    ]);
    await expectInvalidV2(() => undefined, "invalid_exact_svm_payload_unknown_fourth_instruction");
    await expectInvalidV1(() => undefined, "invalid_exact_svm_payload_unknown_fourth_instruction");
  });

  it("handles simulation failures and successful verification for both versions", async () => {
    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString(), [
      "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    ]);

    const failingSigner = createSigner();
    failingSigner.simulateTransaction.mockRejectedValue(new Error("simulation exploded"));
    const v2Fail = new ExactSvmScheme(failingSigner as never);
    const v1Fail = new ExactSvmSchemeV1(failingSigner as never);

    await expect(
      v2Fail.verify(createV2Payload() as never, createV2Requirements() as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "transaction_simulation_failed",
      invalidMessage: "simulation exploded",
    });
    await expect(
      v1Fail.verify(createV1Payload() as never, createV1Requirements() as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "transaction_simulation_failed",
      invalidMessage: "simulation exploded",
    });

    const signer = createSigner();
    const v2 = new ExactSvmScheme(signer as never);
    const v1 = new ExactSvmSchemeV1(signer as never);

    await expect(
      v2.verify(createV2Payload() as never, createV2Requirements() as never),
    ).resolves.toEqual({
      isValid: true,
      invalidReason: undefined,
      payer,
    });
    await expect(
      v1.verify(createV1Payload() as never, createV1Requirements() as never),
    ).resolves.toEqual({
      isValid: true,
      invalidReason: undefined,
      payer,
    });
  });

  it("validates required memo content for both versions", async () => {
    const expectedMemo = "order_12345";
    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString(), [
      MEMO_PROGRAM_ADDRESS,
    ]);
    mockState.instructions[3].data = new TextEncoder().encode("wrong-memo");

    const v2Requirements = createV2Requirements();
    v2Requirements.extra = { feePayer, memo: expectedMemo } as never;
    const v1Requirements = createV1Requirements();
    v1Requirements.extra = { feePayer, memo: expectedMemo } as never;

    const signer = createSigner();
    const v2 = new ExactSvmScheme(signer as never);
    const v1 = new ExactSvmSchemeV1(signer as never);

    await expect(
      v2.verify(createV2Payload() as never, v2Requirements as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_svm_payload_memo_mismatch",
      payer,
    });
    await expect(
      v1.verify(createV1Payload() as never, v1Requirements as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_svm_payload_memo_mismatch",
      payer,
    });

    mockState.instructions[3].data = new TextEncoder().encode(expectedMemo);

    await expect(v2.verify(createV2Payload() as never, v2Requirements as never)).resolves.toEqual({
      isValid: true,
      invalidReason: undefined,
      payer,
    });
    await expect(v1.verify(createV1Payload() as never, v1Requirements as never)).resolves.toEqual({
      isValid: true,
      invalidReason: undefined,
      payer,
    });
  });

  it("rejects missing memo instructions when requirements include extra.memo", async () => {
    mockState.instructions = createInstructions(token.TOKEN_PROGRAM_ADDRESS.toString());

    const v2Requirements = createV2Requirements();
    v2Requirements.extra = { feePayer, memo: "required-memo" } as never;
    const v1Requirements = createV1Requirements();
    v1Requirements.extra = { feePayer, memo: "required-memo" } as never;

    const signer = createSigner();
    const v2 = new ExactSvmScheme(signer as never);
    const v1 = new ExactSvmSchemeV1(signer as never);

    await expect(
      v2.verify(createV2Payload() as never, v2Requirements as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_svm_payload_memo_count",
      payer,
    });
    await expect(
      v1.verify(createV1Payload() as never, v1Requirements as never),
    ).resolves.toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_svm_payload_memo_count",
      payer,
    });
  });

  it("covers settlement success and failure branches for both versions", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const failingSigner = createSigner();
      failingSigner.sendTransaction.mockRejectedValue(new Error("send failed"));
      const v2Fail = new ExactSvmScheme(failingSigner as never, new SettlementCache());
      const v1Fail = new ExactSvmSchemeV1(failingSigner as never, new SettlementCache());

      await expect(
        v2Fail.settle(createV2Payload("tx-fail") as never, createV2Requirements() as never),
      ).resolves.toMatchObject({
        success: false,
        errorReason: "transaction_failed",
        payer,
      });
      await expect(
        v1Fail.settle(createV1Payload("tx-fail-v1") as never, createV1Requirements() as never),
      ).resolves.toMatchObject({
        success: false,
        errorReason: "transaction_failed",
        payer,
      });

      const signer = createSigner();
      const v2 = new ExactSvmScheme(signer as never, new SettlementCache());
      const v1 = new ExactSvmSchemeV1(signer as never, new SettlementCache());

      await expect(
        v2.settle(createV2Payload("tx-success") as never, createV2Requirements() as never),
      ).resolves.toMatchObject({
        success: true,
        transaction: "signature-123",
        payer,
      });
      await expect(
        v1.settle(createV1Payload("tx-success-v1") as never, createV1Requirements() as never),
      ).resolves.toMatchObject({
        success: true,
        transaction: "signature-123",
        payer,
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("covers compute instruction helper edge cases directly", () => {
    const signer = createSigner();
    const v2 = new ExactSvmScheme(signer as never);
    const v1 = new ExactSvmSchemeV1(signer as never);

    expect(() =>
      (v2 as never).verifyComputeLimitInstruction({
        programAddress: programAddress("wrong-program"),
        data: new Uint8Array([2]),
      }),
    ).toThrow("invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction");
    expect(() =>
      (v1 as never).verifyComputeLimitInstruction({
        programAddress: programAddress("wrong-program"),
        data: new Uint8Array([2]),
      }),
    ).toThrow("invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction");

    mockState.computePriceThrows = false;
    mockState.microLamports = BigInt(10_000_000);
    expect(() =>
      (v2 as never).verifyComputePriceInstruction({
        programAddress: programAddress(computeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS.toString()),
        data: new Uint8Array([3]),
      }),
    ).toThrow(
      "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high",
    );
    expect(() =>
      (v1 as never).verifyComputePriceInstruction({
        programAddress: programAddress(computeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS.toString()),
        data: new Uint8Array([3]),
      }),
    ).toThrow(
      "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high",
    );
  });
});
