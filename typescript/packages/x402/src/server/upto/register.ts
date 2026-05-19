import { x402ResourceServer } from "@x402/core/server";
import { Network } from "@x402/core/types";
import { SOLANA_CAIP_FAMILY } from "../../constants";
import { UptoSvmScheme } from "./scheme";

/**
 * Configuration options for registering SVM upto schemes to an x402ResourceServer.
 */
export interface SvmUptoResourceServerConfig {
  /**
   * Optional specific networks to register.
   */
  networks?: Network[];
}

/**
 * Registers SVM upto server schemes to an existing x402ResourceServer.
 *
 * This is server-only. Client payload construction and facilitator settlement
 * are intentionally registered in later, separate PRs.
 */
export function registerUptoSvmScheme(
  server: x402ResourceServer,
  config: SvmUptoResourceServerConfig = {},
): x402ResourceServer {
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      server.register(network, new UptoSvmScheme());
    });
  } else {
    server.register(SOLANA_CAIP_FAMILY, new UptoSvmScheme());
  }

  return server;
}
