import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactSvmScheme } from "@solana/x402/client/exact";
import { readInteropEnvironment, fixtureSettlementHeader } from "./shared";

async function main() {
  const targetUrl = process.env.X402_INTEROP_TARGET_URL;
  if (!targetUrl) {
    throw new Error("X402_INTEROP_TARGET_URL is required");
  }

  const environment = readInteropEnvironment();
  const signer = await createKeyPairSignerFromBytes(environment.clientSecretKey);

  const client = new x402HTTPClient(
    registerExactSvmScheme(new x402Client(), {
      signer,
      rpcUrl: environment.rpcUrl,
      networks: [environment.network as never],
    }),
  );

  const firstResponse = await fetch(targetUrl);
  const paymentRequired = client.getPaymentRequiredResponse(name => firstResponse.headers.get(name));
  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = client.encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await fetch(targetUrl, {
    headers: paymentHeaders,
  });

  const rawBody = await paidResponse.text();
  let responseBody: unknown = rawBody;
  try {
    responseBody = JSON.parse(rawBody);
  } catch {
    // Keep raw string when the response body is not JSON.
  }

  console.log(
    JSON.stringify({
      type: "result",
      implementation: "typescript",
      role: "client",
      ok: paidResponse.ok,
      status: paidResponse.status,
      responseHeaders: Object.fromEntries(paidResponse.headers.entries()),
      responseBody,
      settlement: paidResponse.headers.get(fixtureSettlementHeader),
    }),
  );
}

void main();
