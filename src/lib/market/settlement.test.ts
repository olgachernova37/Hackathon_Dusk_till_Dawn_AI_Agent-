import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { getPendingAction, saveReceipt } from "../agent/store.ts";
import { kv } from "../kv.ts";
import { hashAction } from "../worldid/hash.ts";
import { confirmFunding, createDeal, deliver, judgeDeal } from "./deals.ts";
import type { FetchLike } from "./openai.ts";
import { fundingGate } from "./policy.ts";
import { setSettlementRail, type SettlementRail, type TransferResult } from "./settlement.ts";
import type { ProviderRisk } from "./types.ts";

const clean = { checkProvider: async (address: string): Promise<ProviderRisk> => ({ address, available: true, score: 0, reasons: [] }) };
const judgeSays = (verdict: string): { apiKey: string; fetchImpl: FetchLike } => ({
  apiKey: "k",
  fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdict, reason: verdict, confidence: 0.95 }) } }] })),
});

/** A fake chain that records every transfer and can be told to fail. */
function fakeChain() {
  const sent: { kind: string; to: string; amountUsd: number }[] = [];
  let next: TransferResult | null = null;
  let n = 0;
  const tx = (to: string, amountUsd: number): TransferResult => ({ ok: true, tx: { network: "base-sepolia", hash: `0x${(++n).toString(16).padStart(64, "0")}`, url: "https://sepolia.basescan.org/tx/x", from: "0xbuyer", to, amountUsd, at: Date.now() } });
  const run = (kind: string, to: string, amountUsd: number) => {
    if (next) { const r = next; next = null; return r; }
    sent.push({ kind, to, amountUsd });
    return tx(to, amountUsd);
  };
  const rail: SettlementRail = {
    mode: "base-sepolia",
    explorer: "https://sepolia.basescan.org",
    buyerAddress: "0x00000000000000000000000000000000000000b0",
    escrowAddress: "0x00000000000000000000000000000000000000e0",
    lock: async (a) => run("lock", "escrow", a),
    release: async (to, a) => run("release", to, a),
    refund: async (a) => run("refund", "buyer", a),
  };
  return { rail, sent, failNext: (r: TransferResult) => { next = r; } };
}

// Own store: the daily spend total must not be shared with test files running in parallel.
process.env.KV_DIR = path.join(os.tmpdir(), `market-settlement-${process.pid}`);

let chain = fakeChain();
const today = () => `market:spent:${new Date().toISOString().slice(0, 10)}`;
beforeEach(async () => { chain = fakeChain(); setSettlementRail(chain.rail); await kv().set(today(), 0); delete process.env.MARKET_MAX_PAYMENT_USD; delete process.env.MARKET_DAILY_CAP_USD; });
afterEach(() => setSettlementRail(null));

test("a small deal moves real money twice: lock, then release to the provider", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'hi' into Czech" }, clean);
  assert.equal(deal.status, "funded");
  assert.equal(deal.settlement, "base-sepolia");
  assert.ok(deal.fundingTx?.hash);
  await deliver(deal.id, "Ahoj");
  const { deal: settled } = await judgeDeal(deal.id, judgeSays("accepted"));
  assert.equal(settled.status, "released");
  assert.equal(settled.payoutTx?.to, deal.payTo);
  assert.deepEqual(chain.sent.map((s) => s.kind), ["lock", "release"]);
});

test("a rejected delivery refunds the buyer's wallet on chain", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "summarize", task: "Summarize X" }, clean);
  await deliver(deal.id, "lorem");
  const { deal: settled } = await judgeDeal(deal.id, judgeSays("rejected"));
  assert.equal(settled.status, "refunded");
  assert.deepEqual(chain.sent.map((s) => s.kind), ["lock", "refund"]);
});

test("the per-payment hard cap blocks the payment in code", async () => {
  process.env.MARKET_MAX_PAYMENT_USD = "0.01";
  const result = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'yes'" }, clean);
  assert.equal(result.deal.status, "awaiting_approval");
  assert.match(result.paymentError ?? "", /hard cap of \$0\.01 per payment/);
  assert.equal(chain.sent.length, 0);
});

test("the daily hard cap blocks once the day's budget is used", async () => {
  process.env.MARKET_DAILY_CAP_USD = "0.03";
  const first = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'a'" }, clean);
  assert.equal(first.deal.status, "funded");
  const second = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'b'" }, clean);
  assert.match(second.paymentError ?? "", /today's hard cap of \$0\.03/);
  assert.equal(chain.sent.length, 1);
});

test("nothing pays twice: a funded deal cannot be funded again", async () => {
  const { deal } = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'c'" }, clean);
  await assert.rejects(confirmFunding(deal.id), /already funded/);
  assert.equal(chain.sent.length, 1);
});

test("a payment refused before sending can be retried, and is then paid once", async () => {
  chain.failNext({ ok: false, reason: "insufficient USDC", broadcast: false });
  const first = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'd'" }, clean);
  assert.match(first.paymentError ?? "", /failed before anything was sent: insufficient USDC/);
  const retried = await confirmFunding(first.deal.id);
  assert.equal(retried.status, "funded");
  assert.equal(chain.sent.length, 1);
});

test("a payment that may have been sent is never retried automatically", async () => {
  chain.failNext({ ok: false, reason: "timeout", broadcast: true });
  const first = await createDeal({ buyer: "buyer-agent", skill: "translate", task: "Translate 'e'" }, clean);
  assert.match(first.paymentError ?? "", /may have been sent/);
  await assert.rejects(confirmFunding(first.deal.id), /already being funded/);
  assert.equal(chain.sent.length, 0);
});

test("a large deal pays only after the Selfie Check, and a failed send keeps the approval", async () => {
  const { deal, approvalActionId } = await createDeal({ buyer: "buyer-agent", skill: "contract_audit", task: "Audit X" }, clean);
  assert.equal(chain.sent.length, 0);
  const action = await getPendingAction(approvalActionId!);
  await saveReceipt({ actionId: action!.id, actionHash: hashAction(action!.payload), nullifierHash: "0xh", credentialType: "selfie_check", verifiedAt: Date.now(), expiresAt: Date.now() + 60_000 });
  chain.failNext({ ok: false, reason: "no gas", broadcast: false });
  await assert.rejects(confirmFunding(deal.id), /failed before anything was sent/);
  const funded = await confirmFunding(deal.id);
  assert.equal(funded.status, "funded");
  assert.match(funded.history.at(-1)!.note, /Human approved with Selfie Check/);
  assert.equal(chain.sent.length, 1);
});

test("advisory mode keeps the Graph evidence but does not gate on it", () => {
  const empty: ProviderRisk = { address: "0x", available: true, score: 50, reasons: ["no history"] };
  assert.equal(fundingGate(0.05, empty, "enforce").length, 1);
  assert.deepEqual(fundingGate(0.05, empty, "advisory"), []);
  assert.equal(fundingGate(2, empty, "advisory").length, 1);
});

test("MARKET_CHAIN picks Ethereum Sepolia with Circle's USDC there", async () => {
  const { NETWORKS, selectedNetwork } = await import("./settlement.ts");
  process.env.MARKET_CHAIN = "sepolia";
  assert.equal(selectedNetwork(), "sepolia");
  assert.equal(NETWORKS.sepolia.usdc, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  delete process.env.MARKET_CHAIN;
  assert.equal(selectedNetwork(), "base-sepolia");
});
