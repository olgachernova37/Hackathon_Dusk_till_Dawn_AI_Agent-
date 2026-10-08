import assert from "node:assert/strict";
import test from "node:test";
import { applyEvent, describeFunds, isTerminal, nextStatus } from "./escrow.ts";
import type { Deal } from "./types.ts";

const base: Deal = {
  id: "deal-1",
  buyer: "buyer-agent",
  skill: "translate",
  task: "Translate hello",
  providerId: "lingo-fast",
  payTo: "0x1111111111111111111111111111111111111111",
  amountUsd: 0.02,
  status: "awaiting_approval",
  settlement: "simulated",
  fundingRequiresHuman: false,
  fundingReasons: [],
  providerRisk: { address: "0x1111111111111111111111111111111111111111", available: true, score: 0, reasons: [] },
  createdAt: 0,
  history: [],
};

test("the happy path moves approve → deliver → release", () => {
  let deal = applyEvent(base, "approve", "ok", 1);
  assert.equal(deal.status, "funded");
  deal = applyEvent(deal, "deliver", "ok", 2);
  assert.equal(deal.status, "delivered");
  deal = applyEvent(deal, "release", "ok", 3);
  assert.equal(deal.status, "released");
  assert.deepEqual(deal.history.map((h) => h.event), ["approve", "deliver", "release"]);
});

test("money cannot be released before the work is delivered", () => {
  assert.throws(() => nextStatus("funded", "release"), /Cannot release a deal that is funded/);
  assert.throws(() => nextStatus("awaiting_approval", "release"), /Cannot release/);
});

test("a dispute ends in exactly one payout", () => {
  assert.equal(nextStatus("delivered", "escalate"), "disputed");
  assert.equal(nextStatus("disputed", "release"), "released");
  assert.equal(nextStatus("disputed", "refund"), "refunded");
  assert.throws(() => nextStatus("disputed", "escalate"));
});

test("terminal states accept no further events", () => {
  for (const status of ["released", "refunded", "cancelled"] as const) {
    assert.ok(isTerminal(status));
    for (const event of ["approve", "deliver", "escalate", "release", "refund", "cancel"] as const) {
      assert.throws(() => nextStatus(status, event));
    }
  }
});

test("applyEvent never mutates the original deal", () => {
  const funded = applyEvent(base, "approve", "ok", 1);
  assert.equal(base.status, "awaiting_approval");
  assert.equal(base.history.length, 0);
  assert.equal(funded.history.length, 1);
});

test("describeFunds says where the money is", () => {
  assert.match(describeFunds({ ...base, status: "funded" }), /locked in escrow/);
  assert.match(describeFunds({ ...base, status: "released" }), /paid to 0x1111/);
  assert.match(describeFunds({ ...base, status: "refunded" }), /returned to buyer-agent/);
});
