import assert from "node:assert/strict";
import test from "node:test";
import { fundingGate } from "./policy.ts";
import type { ProviderRisk } from "./types.ts";

const wallet = (score: number | null, available = true): ProviderRisk => ({ address: "0xabc", available, score, reasons: [] });

test("a small amount to a clean wallet needs no human", () => {
  assert.deepEqual(fundingGate(0.05, wallet(0)), []);
});

test("each trigger adds its own reason", () => {
  assert.equal(fundingGate(25, wallet(0)).length, 1);
  assert.equal(fundingGate(0.05, wallet(50)).length, 1);
  assert.equal(fundingGate(0.05, wallet(null, false)).length, 1);
  assert.equal(fundingGate(25, wallet(80)).length, 2);
});

test("the risk gate sits at the shared threshold", () => {
  assert.deepEqual(fundingGate(0.05, wallet(49)), []);
  assert.equal(fundingGate(0.05, wallet(50)).length, 1);
});
