import assert from "node:assert/strict";
import test from "node:test";
import type { AgentAction, HumanGateReceipt } from "@/lib/types";
import { hashAction } from "../worldid/hash.ts";
import { execute } from "./execute.ts";

const action: AgentAction = { id: `execute-test-${Date.now()}`, kind: "recipe_run", summary: "test", payload: {}, riskScore: 80, riskReasons: [], costUsd: 0.05, requiresHuman: true, createdAt: Date.now() };

test("execute refuses a gated action without a receipt", async () => {
  await assert.rejects(execute(action), /human approval receipt required/);
});

test("execute refuses a non-gated action without a receipt", async () => {
  await assert.rejects(execute({ ...action, id: `${action.id}-free`, requiresHuman: false, costUsd: 0 }), /valid human approval receipt/);
});

// Guards against the gate failing OPEN. If receipt validation were ever left
// un-awaited, its rejection would float away and execution would fall through
// to runRecipe, which fails with some *other* error (this payload has no
// address). Asserting the *hash mismatch* message proves the gate stopped
// execution before any payment step was reached.
test("execute rejects an invalid receipt at the gate, before any payment step", async () => {
  const gated: AgentAction = { ...action, id: `${action.id}-forged`, payload: { amount: 5 } };
  const forged: HumanGateReceipt = { actionId: gated.id, actionHash: hashAction({ amount: 999 }), nullifierHash: "0xforged", credentialType: "orb", verifiedAt: Date.now(), expiresAt: Date.now() + 60_000 };
  await assert.rejects(execute(gated, forged), (error: Error) => {
    assert.match(error.message, /actionHash mismatch/);
    assert.doesNotMatch(error.message, /Dependency unavailable/);
    return true;
  });
});
