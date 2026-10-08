import assert from "node:assert/strict";
import test from "node:test";
import type { HumanGateReceipt } from "../types.ts";
import { getPendingAction, saveReceipt } from "../agent/store.ts";
import { hashAction } from "../worldid/hash.ts";
import { confirmFunding, createDeal, deliver, getDeal, judgeDeal, resolveDispute } from "./deals.ts";
import type { FetchLike } from "./judge.ts";
import type { ProviderRisk } from "./types.ts";

/** Stands in for The Graph: a wallet with a clean, long swap history. */
const cleanWallet = async (address: string): Promise<ProviderRisk> => ({
  address, available: true, score: 0, reasons: [], txCount: 150, firstSeen: Date.now() - 400 * 86_400_000, totalVolumeUsd: 12_000,
  source: { subgraphId: "test-subgraph", queriedAt: Date.now() },
});
const clean = { checkProvider: cleanWallet };

const judgeSays = (verdict: string, confidence = 0.95): { apiKey: string; fetchImpl: FetchLike } => ({
  apiKey: "test",
  fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdict, reason: `judge says ${verdict}`, confidence }) } }] })),
});

/** Stands in for /api/worldid/verify: a receipt bound to the approval action. */
async function humanApproves(actionId: string, overrides: Partial<HumanGateReceipt> = {}): Promise<void> {
  const action = await getPendingAction(actionId);
  assert.ok(action, "approval action must exist");
  const now = Date.now();
  await saveReceipt({
    actionId,
    actionHash: hashAction(action.payload),
    nullifierHash: "0xtest-human",
    credentialType: "selfie_check",
    verifiedAt: now,
    expiresAt: now + 60_000,
    ...overrides,
  });
}

test("story A: a small deal runs agent-to-agent with no Selfie Check", async () => {
  const { deal, discovery, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'good morning' to Czech" }, clean);
  assert.equal(discovery.provider.id, "lingo-fast");
  assert.equal(approvalActionId, undefined);
  assert.equal(deal.status, "funded");
  assert.equal(deal.settlement, "simulated");

  await deliver(deal.id, "Dobré ráno");
  const judged = await judgeDeal(deal.id, judgeSays("accepted"));
  assert.equal(judged.deal.status, "released");
  assert.equal(judged.approvalActionId, undefined);
});

test("a small deal with a bad delivery is refunded", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "summarize", task: "Summarize this report in one line" }, clean);
  await deliver(deal.id, "lorem ipsum");
  const judged = await judgeDeal(deal.id, judgeSays("rejected"));
  assert.equal(judged.deal.status, "refunded");
});

test("story B: a large deal waits for a Selfie Check before any money is locked", async () => {
  const { deal, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "contract_audit", task: "Audit the escrow contract for reentrancy" }, clean);
  assert.equal(deal.status, "awaiting_approval");
  assert.ok(approvalActionId);
  const action = await getPendingAction(approvalActionId);
  assert.equal(action?.requiresHuman, true);
  assert.equal(action?.payload.dealId, deal.id);

  await assert.rejects(confirmFunding(deal.id), /Waiting for a human/);
  await assert.rejects(deliver(deal.id, "too early"), /Cannot deliver/);

  await humanApproves(approvalActionId);
  const funded = await confirmFunding(deal.id);
  assert.equal(funded.status, "funded");
  await assert.rejects(confirmFunding(deal.id), /already funded/);

  await deliver(deal.id, "No reentrancy: state is updated before the external call.");
  // Large amount: even a confident accept goes to a human.
  const judged = await judgeDeal(deal.id, judgeSays("accepted"));
  assert.equal(judged.deal.status, "disputed");
  assert.equal(judged.deal.proposedOutcome, "release");
  assert.ok(judged.approvalActionId);
  await assert.rejects(resolveDispute(deal.id), /Waiting for a human/);

  await humanApproves(judged.approvalActionId);
  const settled = await resolveDispute(deal.id);
  assert.equal(settled.status, "released");
  await assert.rejects(resolveDispute(deal.id), /not disputed/);
});

test("a receipt bound to a different payload does not unlock funding", async () => {
  const { deal, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "contract_audit", task: "Audit contract X" }, clean);
  assert.ok(approvalActionId);
  await humanApproves(approvalActionId, { actionHash: hashAction({ dealId: deal.id, amountUsd: 0.01 }) });
  await assert.rejects(confirmFunding(deal.id), /not bound to this deal/);
  assert.equal((await getDeal(deal.id))?.status, "awaiting_approval");
});

test("an expired receipt does not unlock funding", async () => {
  const { deal, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "contract_audit", task: "Audit contract Y" }, clean);
  assert.ok(approvalActionId);
  await humanApproves(approvalActionId, { expiresAt: Date.now() - 1 });
  await assert.rejects(confirmFunding(deal.id), /expired/);
});

test("when no model can judge, a small deal escalates instead of paying", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'thanks' to Ukrainian" }, clean);
  await deliver(deal.id, "Дякую");
  const judged = await judgeDeal(deal.id, { apiKey: "" });
  assert.equal(judged.verdict.judgedBy, "unavailable");
  assert.equal(judged.deal.status, "disputed");
  assert.equal(judged.deal.proposedOutcome, "refund");
});

test("unknown skills and empty input are rejected with clear errors", async () => {
  await assert.rejects(createDeal({ buyer: "b", skill: "juggling", task: "t" }, clean), /No provider offers/);
  await assert.rejects(createDeal({ buyer: "", skill: "translate", task: "t" }, clean), /buyer is required/);
  await assert.rejects(judgeDeal("missing-deal"), /No deal with id/);
});

test("a small deal to a wallet the Graph flags waits for a human", async () => {
  const risky = async (address: string): Promise<ProviderRisk> => ({ address, available: true, score: 50, reasons: ["No Uniswap V3 swap history found"], txCount: 0, firstSeen: null, totalVolumeUsd: 0, source: { subgraphId: "s", queriedAt: Date.now() } });
  const { deal, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'hi'" }, { checkProvider: risky });
  assert.equal(deal.status, "awaiting_approval");
  assert.ok(approvalActionId);
  assert.match(deal.fundingReasons.join(" "), /scores 50\/100/);
  assert.equal((await getPendingAction(approvalActionId))?.riskScore, 50);
});

test("when the Graph cannot be read, a small deal fails closed to a human", async () => {
  const offline = async (address: string): Promise<ProviderRisk> => ({ address, available: false, score: null, reasons: ["offline"] });
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'bye'" }, { checkProvider: offline });
  assert.equal(deal.status, "awaiting_approval");
  assert.match(deal.fundingReasons.join(" "), /could not be read/);
});

test("the Graph evidence is kept on the deal", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'yes'" }, clean);
  assert.equal(deal.providerRisk.txCount, 150);
  assert.equal(deal.providerRisk.source?.subgraphId, "test-subgraph");
  assert.deepEqual(deal.fundingReasons, []);
});
