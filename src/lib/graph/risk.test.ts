import assert from "node:assert/strict";
import test from "node:test";
import { assessRisk } from "./risk.ts";
import { computeRequiresHuman, RISK_GATE_THRESHOLD, type WalletActivity } from "../types.ts";

function activity(overrides: Partial<WalletActivity> = {}): WalletActivity {
  return { address: "0xabc", firstSeen: null, txCount: 0, uniqueCounterparties: 0, totalVolumeUsd: 0, topCounterparties: [], source: { subgraphId: "test-subgraph", queriedAt: 1 }, ...overrides };
}

test("empty swap history is not described as a new wallet", () => {
  const result = assessRisk(activity());
  assert.match(result.reasons[0], /No Uniswap V3 swap history/);
  assert.doesNotMatch(result.reasons[0], /brand-new|no activity/i);
});

test("empty history is counted once and lands exactly on the gate: a human decides", () => {
  const result = assessRisk(activity());
  assert.equal(result.reasons.length, 1, "no redundant 'Only 0 swaps' reason");
  assert.equal(result.score, RISK_GATE_THRESHOLD);
  assert.equal(computeRequiresHuman(result.score, 0), true, "unknown wallet must not clear automatically");
});

test("recent concentrated activity produces explainable risk", () => {
  const result = assessRisk(activity({ firstSeen: Date.now() - 2 * 86_400_000, txCount: 4, uniqueCounterparties: 1, topCounterparties: [{ address: "0x1", count: 4 }] }));
  assert.equal(result.score, 75);
  assert.equal(result.reasons.length, 3);
});