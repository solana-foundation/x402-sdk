import { describe, expect, it, vi } from "vitest";
import { registerExactSvmScheme as registerClientExactSvmScheme } from "../../src/client/exact";
import { registerExactSvmScheme as registerFacilitatorExactSvmScheme } from "../../src/facilitator/exact";
import { registerExactSvmScheme as registerServerExactSvmScheme } from "../../src/server/exact";
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } from "../../src/protocol/schemes/exact";

describe("registerExactSvmScheme", () => {
  it("registers client schemes for explicit networks and policies", () => {
    const client = {
      register: vi.fn(),
      registerV1: vi.fn(),
      registerPolicy: vi.fn(),
    };
    const signer = {
      address: "Signer1111111111111111111111111111111111",
      signTransactions: vi.fn(),
    };
    const policy = { name: "test-policy" };

    const result = registerClientExactSvmScheme(client as never, {
      signer: signer as never,
      networks: [SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2] as never,
      rpcUrl: "http://127.0.0.1:8899",
      policies: [policy] as never,
    });

    expect(result).toBe(client);
    expect(client.register).toHaveBeenCalledTimes(2);
    expect(client.register).toHaveBeenNthCalledWith(
      1,
      SOLANA_DEVNET_CAIP2,
      expect.objectContaining({ scheme: "exact" }),
    );
    expect(client.register).toHaveBeenNthCalledWith(
      2,
      SOLANA_MAINNET_CAIP2,
      expect.objectContaining({ scheme: "exact" }),
    );
    expect(client.registerV1).toHaveBeenCalledTimes(3);
    expect(client.registerPolicy).toHaveBeenCalledWith(policy);

    const v2Scheme = client.register.mock.calls[0][1] as { config?: { rpcUrl?: string } };
    const v1Scheme = client.registerV1.mock.calls[0][1] as { config?: { rpcUrl?: string } };
    expect(v2Scheme.config?.rpcUrl).toBe("http://127.0.0.1:8899");
    expect(v1Scheme.config?.rpcUrl).toBe("http://127.0.0.1:8899");
  });

  it("registers the client wildcard network when no networks are provided", () => {
    const client = {
      register: vi.fn(),
      registerV1: vi.fn(),
      registerPolicy: vi.fn(),
    };
    const signer = {
      address: "Signer1111111111111111111111111111111111",
      signTransactions: vi.fn(),
    };

    registerClientExactSvmScheme(client as never, {
      signer: signer as never,
    });

    expect(client.register).toHaveBeenCalledWith(
      "solana:*",
      expect.objectContaining({ scheme: "exact" }),
    );
    expect(client.registerV1).toHaveBeenCalledTimes(3);
    expect(client.registerPolicy).not.toHaveBeenCalled();
  });

  it("registers resource server schemes for explicit networks and wildcard fallback", () => {
    const explicitServer = {
      register: vi.fn(),
    };
    const wildcardServer = {
      register: vi.fn(),
    };

    const explicitResult = registerServerExactSvmScheme(explicitServer as never, {
      networks: [SOLANA_DEVNET_CAIP2] as never,
    });
    const wildcardResult = registerServerExactSvmScheme(wildcardServer as never);

    expect(explicitResult).toBe(explicitServer);
    expect(explicitServer.register).toHaveBeenCalledWith(
      SOLANA_DEVNET_CAIP2,
      expect.objectContaining({ scheme: "exact" }),
    );
    expect(wildcardResult).toBe(wildcardServer);
    expect(wildcardServer.register).toHaveBeenCalledWith(
      "solana:*",
      expect.objectContaining({ scheme: "exact" }),
    );
  });

  it("shares one settlement cache across facilitator V1 and V2 registrations", () => {
    const facilitator = {
      register: vi.fn(),
      registerV1: vi.fn(),
    };
    const signer = {
      getAddresses: vi.fn().mockReturnValue(["FeePayer1111111111111111111111111111"] as const),
      signTransaction: vi.fn(),
      simulateTransaction: vi.fn(),
      sendTransaction: vi.fn(),
      confirmTransaction: vi.fn(),
    };

    const result = registerFacilitatorExactSvmScheme(facilitator as never, {
      signer: signer as never,
      networks: SOLANA_DEVNET_CAIP2 as never,
    });

    expect(result).toBe(facilitator);
    expect(facilitator.register).toHaveBeenCalledWith(
      SOLANA_DEVNET_CAIP2,
      expect.objectContaining({ scheme: "exact" }),
    );
    expect(facilitator.registerV1).toHaveBeenCalledTimes(1);

    const v2Scheme = facilitator.register.mock.calls[0][1] as { settlementCache?: unknown };
    const v1Scheme = facilitator.registerV1.mock.calls[0][1] as { settlementCache?: unknown };
    expect(v2Scheme.settlementCache).toBeDefined();
    expect(v2Scheme.settlementCache).toBe(v1Scheme.settlementCache);
  });
});
