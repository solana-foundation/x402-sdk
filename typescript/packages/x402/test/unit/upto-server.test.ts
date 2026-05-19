import { describe, expect, it, vi } from "vitest";
import { UptoSvmScheme, registerUptoSvmScheme } from "../../src/server/upto";
import {
  SOLANA_DEVNET_CAIP2,
  USDC_DEVNET_ADDRESS,
} from "../../src/protocol/schemes/exact";
import { UPTO_SCHEME } from "../../src/protocol/schemes/upto";

describe("UptoSvmScheme server", () => {
  it("uses the x402 upto scheme identifier", () => {
    expect(new UptoSvmScheme().scheme).toBe(UPTO_SCHEME);
  });

  it("parses maximum prices with the same SVM asset conversion as exact", async () => {
    const result = await new UptoSvmScheme().parsePrice("$0.001", SOLANA_DEVNET_CAIP2);

    expect(result).toEqual({
      amount: "1000",
      asset: USDC_DEVNET_ADDRESS,
      extra: {},
    });
  });

  it("registers the server scheme without enabling client or facilitator support", () => {
    const server = {
      register: vi.fn(),
    };

    const result = registerUptoSvmScheme(server as never, {
      networks: [SOLANA_DEVNET_CAIP2] as never,
    });

    expect(result).toBe(server);
    expect(server.register).toHaveBeenCalledWith(
      SOLANA_DEVNET_CAIP2,
      expect.objectContaining({ scheme: UPTO_SCHEME }),
    );
  });
});
