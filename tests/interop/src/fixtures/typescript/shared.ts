import { interopScenario } from "../../contracts";

export type InteropEnvironment = {
  rpcUrl: string;
  network: string;
  mint: string;
  payTo: string;
  clientSecretKey: Uint8Array;
  facilitatorSecretKey: Uint8Array;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseSecretKey(name: string): Uint8Array {
  const raw = readRequiredEnv(name);
  const parsed = JSON.parse(raw) as number[];
  return new Uint8Array(parsed);
}

export function readInteropEnvironment(): InteropEnvironment {
  return {
    rpcUrl: readRequiredEnv("X402_INTEROP_RPC_URL"),
    network: process.env.X402_INTEROP_NETWORK ?? interopScenario.network,
    mint: process.env.X402_INTEROP_MINT ?? interopScenario.asset,
    payTo: readRequiredEnv("X402_INTEROP_PAY_TO"),
    clientSecretKey: parseSecretKey("X402_INTEROP_CLIENT_SECRET_KEY"),
    facilitatorSecretKey: parseSecretKey("X402_INTEROP_FACILITATOR_SECRET_KEY"),
  };
}

export const fixtureSettlementHeader = interopScenario.settlementHeader;
