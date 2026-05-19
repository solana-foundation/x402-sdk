import type {
  AssetAmount,
  MoneyParser,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
} from "@x402/core/types";
import { UPTO_SCHEME } from "../../protocol/schemes/upto";
import { ExactSvmScheme } from "../exact";

/**
 * SVM server implementation for the x402 Upto payment scheme.
 *
 * This server-side scheme intentionally reuses exact's SVM price parsing and
 * facilitator fee-payer requirement enrichment. Client and facilitator support
 * are added separately so the harness can review the scheme boundary before
 * enabling settlement behavior.
 */
export class UptoSvmScheme implements SchemeNetworkServer {
  readonly scheme = UPTO_SCHEME;
  private readonly exact = new ExactSvmScheme();

  registerMoneyParser(parser: MoneyParser): UptoSvmScheme {
    this.exact.registerMoneyParser(parser);
    return this;
  }

  parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    return this.exact.parsePrice(price, network);
  }

  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    return this.exact.enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys);
  }
}
