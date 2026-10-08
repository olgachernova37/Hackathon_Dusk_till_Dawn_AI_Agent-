import assert from "node:assert/strict";
import test from "node:test";
import type { AgentAction, HumanGateReceipt } from "@/lib/types";
import { hashAction } from "./hash.ts";
import { assertValidReceipt } from "./receipt.ts";

function action(id: string): AgentAction {
  return { id, kind: "recipe_run", summary: "test", payload: { amount: 5, destination: "0xabc" }, riskScore: 80, riskReasons: [], costUsd: 0.05, requiresHuman: true, createdAt: Date.now() };
}

function receiptFor(current: AgentAction, overrides: Partial<HumanGateReceipt> = {}): HumanGateReceipt {
  return { actionId: current.id, actionHash: hashAction(current.payload), nullifierHash: "0xnullifier", credentialType: "selfie_check", verifiedAt: Date.now(), expiresAt: Date.now() + 60_000, ...overrides };
}

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random()}`;

test("tampering with one payload byte invalidates the receipt", async () => {
  const current = action(unique("tamper"));
  const receipt = receiptFor(current);
  current.payload = { amount: 6, destination: "0xabc" };
  await assert.rejects(assertValidReceipt(receipt, current), /actionHash mismatch/);
});

test("receipt validation has distinct expiry, id, hash, and replay errors", async () => {
  const expired = action(unique("expired"));
  await assert.rejects(assertValidReceipt(receiptFor(expired, { expiresAt: Date.now() - 1 }), expired), /expired/);

  const wrongId = action(unique("wrong-id"));
  await assert.rejects(assertValidReceipt({ ...receiptFor(wrongId), actionId: "other" }, wrongId), /actionId mismatch/);

  const wrongHash = action(unique("wrong-hash"));
  await assert.rejects(assertValidReceipt({ ...receiptFor(wrongHash), actionHash: "0xwrong" }, wrongHash), /actionHash mismatch/);

  const replay = action(unique("replay"));
  const valid = receiptFor(replay);
  await assert.doesNotReject(assertValidReceipt(valid, replay));
  await assert.rejects(assertValidReceipt(valid, replay), /already executed/);
});

test("concurrent validations of one action: exactly one wins the claim", async () => {
  const current = action(unique("race"));
  const receipt = receiptFor(current);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => assertValidReceipt(receipt, current)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 7);
});
