import { createKeyPairSignerFromBytes } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  buildSIWxExtension,
  createSIWxHeader,
  createSIWxHeaderForChallenge,
  createSIWxPayload,
  DEFAULT_SOLANA_SIWX_CHAINS,
  encodeSIWxHeader,
  formatSIWSMessage,
  getSIWxExtension,
  parseSIWxHeader,
  selectSIWxChain,
  SIGN_IN_WITH_X,
  SIGN_IN_WITH_X_HEADER,
  SOLANA_DEVNET_SIWX_CHAIN,
  SOLANA_MAINNET_SIWX_CHAIN,
  validateSIWxMessage,
  verifySIWxPayload,
  type CompleteSIWxInfo,
  type KitMessageSigner,
  type SIWxPayload,
  type WalletAdapterMessageSigner,
} from "../../src";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
} from "../../src/protocol/schemes/exact";

const TEST_KEYPAIR_BYTES = new Uint8Array([
  41, 99, 180, 88, 51, 57, 48, 80, 61, 63, 219, 75, 176, 49, 116, 254, 227, 176, 196, 204, 122, 47,
  166, 133, 155, 252, 217, 0, 253, 17, 49, 143, 47, 94, 121, 167, 195, 136, 72, 22, 157, 48, 77, 88,
  63, 96, 57, 122, 181, 243, 236, 188, 241, 134, 174, 224, 100, 246, 17, 170, 104, 17, 151, 48,
]);

function challenge() {
  return buildSIWxExtension({
    domain: "example.com",
    uri: "https://example.com/reports",
    statement: "Sign in to use this endpoint.",
    version: "1",
    nonce: "nonce-123",
    issuedAt: "2026-04-27T00:00:00.000Z",
    expirationTime: "2026-04-27T00:10:00.000Z",
    requestId: "request-123",
    resources: ["https://example.com/reports"],
  });
}

describe("SIWX", () => {
  it("formats the canonical Solana sign-in message", () => {
    const info: CompleteSIWxInfo = {
      domain: "example.com",
      address: "4BuiY9QUUfPoAGNJBja3JapAuVWMc9c7in6UCgyC2zPR",
      uri: "https://example.com/reports",
      statement: "Sign in to use this endpoint.",
      version: "1",
      chainId: SOLANA_DEVNET_CAIP2,
      nonce: "nonce-123",
      issuedAt: "2026-04-27T00:00:00.000Z",
      type: "ed25519",
      signatureScheme: "siws",
    };

    expect(formatSIWSMessage(info)).toBe(
      "example.com wants you to sign in with your Solana account:\n" +
        "4BuiY9QUUfPoAGNJBja3JapAuVWMc9c7in6UCgyC2zPR\n\n" +
        "Sign in to use this endpoint.\n\n" +
        "URI: https://example.com/reports\n" +
        "Version: 1\n" +
        "Chain ID: EtWTRABZaYq6iMfeYKouRu166VU2xqa1\n" +
        "Nonce: nonce-123\n" +
        "Issued At: 2026-04-27T00:00:00.000Z",
    );
  });

  it("selects a compatible chain using client preferences", () => {
    const extension = challenge();

    expect(selectSIWxChain(extension, { preferredChainId: "solana-devnet" }).chainId).toBe(
      SOLANA_DEVNET_CAIP2,
    );
    expect(selectSIWxChain(extension, { preferredChainId: "mainnet-beta" }).chainId).toBe(
      SOLANA_MAINNET_CAIP2,
    );
    expect(selectSIWxChain(extension, { preferredChainId: "testnet" }).chainId).toBe(
      SOLANA_TESTNET_CAIP2,
    );
    expect(
      selectSIWxChain(extension, {
        supportedChainIds: [SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2],
      }).chainId,
    ).toBe(SOLANA_DEVNET_CAIP2);
    expect(() => selectSIWxChain(extension, { preferredChainId: "solana:unknown" })).toThrow(
      "siwx_preferred_chain_not_supported",
    );
  });

  it("rejects incompatible or unsupported chain selections", () => {
    const evmOnly = buildSIWxExtension(challenge(), [
      { chainId: "eip155:8453", type: "ed25519", signatureScheme: "siws" },
    ]);

    expect(() => selectSIWxChain(evmOnly)).toThrow("siwx_no_compatible_solana_chain");
    expect(() =>
      selectSIWxChain(buildSIWxExtension(challenge(), [SOLANA_MAINNET_SIWX_CHAIN]), {
        supportedChainIds: [SOLANA_DEVNET_CAIP2],
      }),
    ).toThrow("siwx_no_supported_client_chain");
  });

  it("extracts the SIWX extension from payment-required extensions", () => {
    const extension = challenge();
    const paymentRequired = {
      extensions: {
        [SIGN_IN_WITH_X]: extension,
      },
    };

    expect(getSIWxExtension(paymentRequired)).toEqual(extension);
    expect(SIGN_IN_WITH_X_HEADER).toBe("SIGN-IN-WITH-X");
    expect(DEFAULT_SOLANA_SIWX_CHAINS).toContainEqual(SOLANA_DEVNET_SIWX_CHAIN);
  });

  it("ignores missing or malformed SIWX extensions", () => {
    expect(getSIWxExtension({})).toBeUndefined();
    expect(getSIWxExtension({ extensions: { [SIGN_IN_WITH_X]: "not-an-object" } })).toBeUndefined();
    expect(
      getSIWxExtension({
        extensions: {
          [SIGN_IN_WITH_X]: {
            ...challenge(),
            nonce: undefined,
          },
        },
      }),
    ).toBeUndefined();
  });

  it("signs, encodes, parses, and verifies a payload", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const extension = challenge();
    const chain = selectSIWxChain(extension, { preferredChainId: SOLANA_DEVNET_CAIP2 });
    const payload = await createSIWxPayload(
      {
        ...extension,
        chainId: chain.chainId,
        type: chain.type,
        signatureScheme: chain.signatureScheme,
      },
      signer,
    );

    const header = encodeSIWxHeader(payload);
    expect(parseSIWxHeader(header)).toEqual(payload);
    await expect(verifySIWxPayload(payload)).resolves.toEqual({ valid: true });
  });

  it("accepts kit signers that return signatures under an alternate key", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const fallbackSigner: KitMessageSigner = {
      address: signer.address,
      signMessages: async messages => {
        const signatures = await signer.signMessages(messages);
        const signature = Object.values(signatures[0] ?? {})[0];
        if (!signature) throw new Error("missing signature");
        return [{ fallback: signature }];
      },
    };

    const payload = await createSIWxPayload(
      {
        ...challenge(),
        chainId: SOLANA_DEVNET_CAIP2,
        type: "ed25519",
        signatureScheme: "siws",
      },
      fallbackSigner,
    );

    expect(payload.address).toBe(signer.address);
    await expect(verifySIWxPayload(payload)).resolves.toEqual({ valid: true });
  });

  it("creates a header directly from a payment-required challenge", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const header = await createSIWxHeaderForChallenge(
      {
        extensions: {
          [SIGN_IN_WITH_X]: challenge(),
        },
      },
      signer,
      { preferredChainId: SOLANA_DEVNET_CAIP2 },
    );

    const parsed = parseSIWxHeader(header);
    expect(parsed.chainId).toBe(SOLANA_DEVNET_CAIP2);
    await expect(verifySIWxPayload(parsed)).resolves.toEqual({ valid: true });
  });

  it("requires a SIWX extension when signing from payment-required", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);

    await expect(createSIWxHeaderForChallenge({}, signer)).rejects.toThrow(
      "siwx_extension_missing",
    );
  });

  it("rejects tampered signatures", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const extension = challenge();
    const chain = selectSIWxChain(extension, { preferredChainId: SOLANA_DEVNET_CAIP2 });
    const payload = await createSIWxPayload(
      {
        ...extension,
        chainId: chain.chainId,
        type: chain.type,
        signatureScheme: chain.signatureScheme,
      },
      signer,
    );
    const tamperedPayload: SIWxPayload = { ...payload, nonce: "tampered" };

    await expect(verifySIWxPayload(tamperedPayload)).resolves.toEqual({
      valid: false,
      error: "siwx_signature_mismatch",
    });

    await expect(
      verifySIWxPayload({
        ...payload,
        chainId: "eip155:8453",
      }),
    ).resolves.toEqual({ valid: false, error: "siwx_unsupported_chain" });
  });

  it("validates domain, nonce, and time bounds", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const extension = challenge();
    const payload = await createSIWxPayload(
      {
        ...extension,
        chainId: SOLANA_DEVNET_CAIP2,
        type: "ed25519",
        signatureScheme: "siws",
      },
      signer,
    );

    await expect(
      validateSIWxMessage(payload, "https://example.com/reports/usage", {
        now: new Date("2026-04-27T00:01:00.000Z"),
        expectedNonce: "nonce-123",
      }),
    ).resolves.toEqual({ valid: true });
    await expect(
      validateSIWxMessage(payload, "https://api.example.com/reports", {
        now: new Date("2026-04-27T00:01:00.000Z"),
        expectedNonce: "nonce-123",
      }),
    ).resolves.toEqual({ valid: false, error: "siwx_domain_mismatch" });
    await expect(
      validateSIWxMessage(payload, "https://example.com/reports", {
        now: new Date("2026-04-27T00:01:00.000Z"),
        expectedNonce: "wrong",
      }),
    ).resolves.toEqual({ valid: false, error: "siwx_nonce_mismatch" });
    await expect(
      validateSIWxMessage(payload, "https://example.com/reports", {
        now: new Date("2026-04-27T00:01:00.000Z"),
        expectedNonce: "nonce-123",
        validateNonce: () => false,
      }),
    ).resolves.toEqual({ valid: false, error: "siwx_nonce_rejected" });
    await expect(
      validateSIWxMessage(payload, "https://example.com/reports", {
        now: new Date("2026-04-27T00:20:00.000Z"),
        expectedNonce: "nonce-123",
      }),
    ).resolves.toEqual({ valid: false, error: "siwx_issued_at_too_old" });
  });

  it("creates the explicit selected-chain header", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const header = await createSIWxHeader(
      {
        ...challenge(),
        chainId: SOLANA_DEVNET_CAIP2,
        type: "ed25519",
        signatureScheme: "siws",
      },
      signer,
    );

    expect(parseSIWxHeader(header).chainId).toBe(SOLANA_DEVNET_CAIP2);
  });

  it("rejects signers without an address", async () => {
    await expect(
      createSIWxHeader(
        {
          ...challenge(),
          chainId: SOLANA_DEVNET_CAIP2,
          type: "ed25519",
          signatureScheme: "siws",
        },
        { signMessages: async () => [] } as never,
      ),
    ).rejects.toThrow("siwx_signer_address_missing");
  });

  it("supports wallet-adapter-style message signers", async () => {
    const signer = await createKeyPairSignerFromBytes(TEST_KEYPAIR_BYTES);
    const walletAdapterSigner: WalletAdapterMessageSigner = {
      publicKey: {
        toBase58: () => signer.address,
        toString: () => signer.address,
      },
      signMessage: async message => {
        const signatures = await signer.signMessages([{ content: message, signatures: {} }]);
        const signature = signatures[0]?.[signer.address] ?? Object.values(signatures[0] ?? {})[0];
        if (!signature) throw new Error("missing signature");
        return signature;
      },
    };

    const header = await createSIWxHeader(
      {
        ...challenge(),
        chainId: SOLANA_DEVNET_CAIP2,
        type: "ed25519",
        signatureScheme: "siws",
      },
      walletAdapterSigner,
    );

    const payload = parseSIWxHeader(header);
    expect(payload.address).toBe(signer.address);
    await expect(verifySIWxPayload(payload)).resolves.toEqual({ valid: true });
  });
});
