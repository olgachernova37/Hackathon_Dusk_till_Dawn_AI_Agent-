import assert from "node:assert/strict";
import test from "node:test";
import { getContinuity, recordApproval } from "./continuity.ts";

test("a second approval by the same nullifier reports returning continuity", async () => {
  const nullifier = `test-${Date.now()}-${Math.random()}`;
  const first = await recordApproval(nullifier);
  const second = await recordApproval(nullifier);

  assert.equal(first.isReturning, false);
  assert.equal(first.approvalCount, 1);
  assert.equal(second.isReturning, true);
  assert.equal(second.approvalCount, 2);
  assert.deepEqual(await getContinuity(nullifier), second);
});

test("an unknown nullifier reports a new human", async () => {
  const continuity = await getContinuity(`never-seen-${Date.now()}-${Math.random()}`);
  assert.equal(continuity.isReturning, false);
  assert.equal(continuity.approvalCount, 0);
});
