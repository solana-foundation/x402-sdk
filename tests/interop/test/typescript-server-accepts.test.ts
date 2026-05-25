import { describe, expect, it } from "vitest";
import { buildInteropAcceptsList } from "../src/fixtures/typescript/server";
import { interopScenario } from "../src/contracts";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

describe("typescript interop server accepts list", () => {
  it("emits integer extra.decimals on every accept entry, including USDC", () => {
    const accepts = buildInteropAcceptsList({
      network: interopScenario.network,
      payTo: "11111111111111111111111111111111",
      extraOfferedMints: [
        "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD mainnet
        "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", // USDG mainnet
        "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", // CASH mainnet
      ],
    });

    expect(accepts.length).toBeGreaterThan(1);
    for (const entry of accepts) {
      expect(entry.price.extra).toBeDefined();
      expect(typeof entry.price.extra.decimals).toBe("number");
      expect(Number.isInteger(entry.price.extra.decimals)).toBe(true);
      expect(entry.price.extra.decimals).toBe(6);
      expect(entry.price.extra.tokenProgram).toMatch(
        new RegExp(`^(${TOKEN_PROGRAM}|${TOKEN_2022_PROGRAM})$`),
      );
    }
  });

  it("uses the canonical scenario asset for the primary entry", () => {
    const [primary] = buildInteropAcceptsList({
      network: interopScenario.network,
      payTo: "11111111111111111111111111111111",
      extraOfferedMints: [],
    });

    expect(primary.price.asset).toBe(interopScenario.asset);
    expect(primary.price.extra.decimals).toBe(6);
    expect(primary.price.extra.tokenProgram).toBe(TOKEN_PROGRAM);
  });

  it("routes Token-2022 mints to the Token-2022 program", () => {
    const accepts = buildInteropAcceptsList({
      network: interopScenario.network,
      payTo: "11111111111111111111111111111111",
      extraOfferedMints: [
        "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD mainnet
        "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", // CASH mainnet
      ],
    });

    const pyusd = accepts.find(
      e => e.price.asset === "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    );
    const cash = accepts.find(
      e => e.price.asset === "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
    );
    expect(pyusd?.price.extra.tokenProgram).toBe(TOKEN_2022_PROGRAM);
    expect(cash?.price.extra.tokenProgram).toBe(TOKEN_2022_PROGRAM);
  });
});
