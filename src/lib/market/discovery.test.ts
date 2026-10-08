import assert from "node:assert/strict";
import test from "node:test";
import { SEED_PROVIDERS } from "./catalog.ts";
import { discover } from "./discovery.ts";

test("cheapest strategy picks the lowest price for the skill", () => {
  const result = discover(SEED_PROVIDERS, { skill: "translate" });
  assert.equal(result.provider.id, "lingo-fast");
  assert.deepEqual(result.candidates.map((p) => p.id), ["lingo-fast", "lingo-pro"]);
  assert.match(result.reason, /cheapest/);
});

test("best_rated strategy picks the highest rating", () => {
  const result = discover(SEED_PROVIDERS, { skill: "translate", strategy: "best_rated" });
  assert.equal(result.provider.id, "lingo-pro");
});

test("skill matching ignores case and surrounding spaces", () => {
  assert.equal(discover(SEED_PROVIDERS, { skill: "  Summarize " }).provider.id, "brief-bot");
});

test("a price ceiling excludes providers above it", () => {
  const result = discover(SEED_PROVIDERS, { skill: "summarize", maxPriceUsd: 0.04, strategy: "best_rated" });
  assert.equal(result.provider.id, "brief-bot");
});

test("a minimum rating excludes weaker providers", () => {
  assert.equal(discover(SEED_PROVIDERS, { skill: "translate", minRating: 4.5 }).provider.id, "lingo-pro");
});

test("discovery fails clearly when nothing qualifies", () => {
  assert.throws(() => discover(SEED_PROVIDERS, { skill: "dance" }), /No provider offers/);
  assert.throws(() => discover(SEED_PROVIDERS, { skill: "contract_audit", maxPriceUsd: 1 }), /cheapest costs \$2/);
  assert.throws(() => discover(SEED_PROVIDERS, { skill: "translate", minRating: 5 }), /rating/);
  assert.throws(() => discover(SEED_PROVIDERS, { skill: "translate", maxPriceUsd: -1 }), RangeError);
});

test("ties break deterministically", () => {
  const twins = [
    { id: "b", name: "B", skills: ["x"], priceUsd: 1, payTo: "0x0", rating: 4, jobs: 1 },
    { id: "a", name: "A", skills: ["x"], priceUsd: 1, payTo: "0x0", rating: 4, jobs: 1 },
  ];
  assert.equal(discover(twins, { skill: "x" }).provider.id, "a");
});
