import assert from "node:assert/strict";
import test from "node:test";
import { createPaidFetch } from "./x402.ts";

test("x402 wrapper fails loudly when no burner key is configured", () => {
  const original = process.env.X402_PRIVATE_KEY;
  delete process.env.X402_PRIVATE_KEY;
  assert.throws(() => createPaidFetch(), /Missing X402_PRIVATE_KEY/);
  if (original) process.env.X402_PRIVATE_KEY = original;
});

test("x402 wrapper passes successful responses through", async () => {
  const original = process.env.X402_PRIVATE_KEY;
  process.env.X402_PRIVATE_KEY = `0x${"11".repeat(32)}`;
  const fakeFetch: typeof globalThis.fetch = async () => new Response("ok", { status: 200 });
  const response = await createPaidFetch(fakeFetch)("https://example.test/paid");
  assert.equal(response.status, 200);
  if (original) process.env.X402_PRIVATE_KEY = original; else delete process.env.X402_PRIVATE_KEY;
});

test("x402 wrapper pays Bazantic's 402 challenge on Base mainnet", async () => {
  const original = process.env.X402_PRIVATE_KEY;
  process.env.X402_PRIVATE_KEY = `0x${"11".repeat(32)}`;
  // Body captured from the live EchoBrief gateway: relative resource, no description or mimeType.
  const challenge = { x402Version: 1, accepts: [{ scheme: "exact", network: "base", maxAmountRequired: "50000", resource: "/api/gateway/gate", payTo: "0x7bd6100C620c76d0F3EA7DF36e60c54867211382", maxTimeoutSeconds: 300, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", extra: { name: "USD Coin", version: "2" } }] };
  const paymentHeaders: string[] = [];
  const fakeFetch: typeof globalThis.fetch = async (_input, init) => {
    const payment = new Headers(init?.headers).get("X-PAYMENT");
    if (!payment) return Response.json(challenge, { status: 402 });
    paymentHeaders.push(payment);
    return Response.json({ paid: true });
  };
  const response = await createPaidFetch(fakeFetch)("https://gw.example.test/api/gateway/gate", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(paymentHeaders.length, 1);
  const payment = JSON.parse(Buffer.from(paymentHeaders[0], "base64").toString()) as { network: string; payload: { authorization: { to: string; value: string } } };
  assert.equal(payment.network, "base");
  assert.equal(payment.payload.authorization.to, challenge.accepts[0].payTo);
  assert.equal(payment.payload.authorization.value, "50000");
  if (original) process.env.X402_PRIVATE_KEY = original; else delete process.env.X402_PRIVATE_KEY;
});