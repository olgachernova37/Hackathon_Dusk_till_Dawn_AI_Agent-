import { randomUUID } from "node:crypto";
import type { AgentAction, HumanGateReceipt } from "../types.ts";
// Relative imports, not "@/lib/...": `node --test` cannot resolve the alias.
import { kv, RETENTION_SECONDS } from "../kv.ts";
import { getPendingAction, getReceipt, savePendingAction } from "../agent/store.ts";
import { hashAction } from "../worldid/hash.ts";
import { getProvider, listProviders } from "./catalog.ts";
import { discover } from "./discovery.ts";
import { applyEvent, describeFunds, isTerminal } from "./escrow.ts";
import { judge, settle, type JudgeOptions } from "./judge.ts";
import { doWork, type WorkerOptions } from "./worker.ts";
import { fundingGate } from "./policy.ts";
import { checkProviderWallet } from "./provider-risk.ts";
import { settlementRail, type TransferResult } from "./settlement.ts";
import { releaseSpend, reserveSpend } from "./spend.ts";
import type { Deal, DealEvent, DiscoveryQuery, DiscoveryResult, Provider, ProviderRiskCheck, Verdict } from "./types.ts";

/**
 * Deal orchestration: discovery → (Selfie Check if large) → escrow → delivery
 * → judge → release / refund, with disputes escalated to a human.
 *
 * Human approvals reuse the existing gate unchanged: each approval is an
 * AgentAction saved in the agent store, so the dashboard deep link
 * (/dashboard?action=<id>) and /api/worldid/verify work for it as they do for
 * any other action. The receipt is bound to the exact deal payload.
 */

export class MarketError extends Error {
  // Plain fields, not parameter properties: `node --test` strips types only.
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "MarketError";
    this.code = code;
    this.status = status;
  }
}

const keys = {
  deal: (id: string) => `market:deal:${id}`,
  payout: (id: string) => `market:payout:${id}`,
  funding: (id: string) => `market:funding:${id}`,
  approval: (actionId: string) => `market:approval:${actionId}`,
  ledger: "market:ledger",
};
const retain = { ttlSeconds: RETENTION_SECONDS };

export async function getDeal(id: string): Promise<Deal | undefined> {
  return kv().get<Deal>(keys.deal(id));
}

async function saveDeal(deal: Deal): Promise<Deal> {
  await kv().set(keys.deal(deal.id), deal, retain);
  return deal;
}

async function requireDeal(id: string): Promise<Deal> {
  const deal = await getDeal(id);
  if (!deal) throw new MarketError("DEAL_NOT_FOUND", `No deal with id ${id}`, 404);
  return deal;
}

async function transition(deal: Deal, event: DealEvent, note: string): Promise<Deal> {
  try {
    return await saveDeal(applyEvent(deal, event, note));
  } catch (error) {
    if (error instanceof MarketError) throw error;
    throw new MarketError("INVALID_TRANSITION", error instanceof Error ? error.message : "Invalid transition", 409);
  }
}

// ---------------------------------------------------------------- approvals

/** Builds the AgentAction a human approves with Selfie Check. */
function approvalAction(deal: Deal, purpose: "fund" | "dispute", summary: string, reasons: string[]): AgentAction {
  const payload: Record<string, unknown> = {
    market: purpose,
    dealId: deal.id,
    providerId: deal.providerId,
    payTo: deal.payTo,
    amountUsd: deal.amountUsd,
    task: deal.task,
  };
  if (purpose === "dispute" && deal.proposedOutcome) payload.outcome = deal.proposedOutcome;
  return {
    id: randomUUID(),
    kind: "paid_call",
    summary,
    payload,
    // The provider wallet's live Graph score (0 when the Graph was unreadable;
    // that case is already a stated reason for the gate).
    riskScore: deal.providerRisk.score ?? 0,
    riskReasons: reasons,
    costUsd: deal.amountUsd,
    requiresHuman: true,
    createdAt: Date.now(),
  };
}

/**
 * Checks a Selfie Check receipt against the approval action it must be bound
 * to. Mirrors worldid/receipt.ts but claims under a market key, so the shared
 * replay claim used by /api/agent/execute is not consumed by marketplace use.
 */
async function consumeApproval(actionId: string | undefined): Promise<HumanGateReceipt> {
  if (!actionId) throw new MarketError("NO_APPROVAL_NEEDED", "This step has no human approval attached", 409);
  const action = await getPendingAction(actionId);
  if (!action) throw new MarketError("APPROVAL_NOT_FOUND", "The approval action no longer exists", 404);
  const receipt = await getReceipt(actionId);
  if (!receipt) throw new MarketError("AWAITING_HUMAN", "Waiting for a human to approve with Selfie Check", 409);
  if (receipt.expiresAt <= Date.now()) throw new MarketError("RECEIPT_EXPIRED", "The approval receipt expired; approve again", 409);
  if (receipt.actionId !== action.id) throw new MarketError("RECEIPT_MISMATCH", "Receipt belongs to a different action", 409);
  if (receipt.actionHash !== hashAction(action.payload)) throw new MarketError("RECEIPT_MISMATCH", "Receipt is not bound to this deal", 409);
  const claimed = await kv().setIfAbsent(keys.approval(actionId), Date.now(), retain);
  if (!claimed) throw new MarketError("APPROVAL_USED", "This approval was already used", 409);
  return receipt;
}

// ------------------------------------------------------------------ payments

/**
 * Atomic "at most once" claim. A claim marked "retryable" (the payment was
 * refused before anything was sent) may be taken again; any other value means
 * a payment is in flight or done, and a second one is refused.
 */
async function claimOnce(key: string, value: string): Promise<boolean> {
  if (await kv().setIfAbsent(key, value, retain)) return true;
  if ((await kv().get<string>(key)) !== "retryable") return false;
  await kv().set(key, value, retain);
  return true;
}

async function failPayment(deal: Deal, key: string, result: Extract<TransferResult, { ok: false }>, what: string): Promise<never> {
  // Refused before sending → safe to retry. Sent but unconfirmed → never retried automatically.
  if (!result.broadcast) await kv().set(key, "retryable", retain);
  const message = result.broadcast
    ? `${what} may have been sent and is not retried automatically — check the explorer. ${result.reason}`
    : `${what} failed before anything was sent: ${result.reason}`;
  await saveDeal({ ...deal, paymentError: message });
  throw new MarketError("PAYMENT_FAILED", message, 502);
}

/** buyer → escrow, inside the hard spending caps, at most once per deal. */
async function lockFunds(deal: Deal, note: string): Promise<Deal> {
  const reserved = await reserveSpend(deal.amountUsd);
  if (!reserved.ok) {
    await saveDeal({ ...deal, paymentError: reserved.reason });
    throw new MarketError("SPEND_CAP", reserved.reason, 409);
  }
  if (!(await claimOnce(keys.funding(deal.id), "pending"))) {
    await releaseSpend(deal.amountUsd);
    throw new MarketError("ALREADY_FUNDED", "This deal is already being funded or was funded", 409);
  }
  const result = await settlementRail().lock(deal.amountUsd);
  if (!result.ok) {
    if (!result.broadcast) await releaseSpend(deal.amountUsd);
    return failPayment(deal, keys.funding(deal.id), result, "Locking the funds");
  }
  await kv().set(keys.funding(deal.id), result.tx?.hash ?? "simulated", retain);
  const where = result.tx ? ` — tx ${result.tx.hash}` : " (simulated)";
  const funded = await transition({ ...deal, paymentError: undefined, ...(result.tx && { fundingTx: result.tx }) }, "approve", `${note}${where}`);
  return funded;
}

async function payOut(deal: Deal, event: "release" | "refund", note: string): Promise<Deal> {
  // At most one payout per deal, even under concurrent requests.
  if (!(await claimOnce(keys.payout(deal.id), event))) throw new MarketError("ALREADY_SETTLED", "This deal was already paid out", 409);
  const rail = settlementRail();
  const result = event === "release" ? await rail.release(deal.payTo, deal.amountUsd) : await rail.refund(deal.amountUsd);
  if (!result.ok) return failPayment(deal, keys.payout(deal.id), result, event === "release" ? "Paying the provider" : "Refunding the buyer");
  const where = result.tx ? ` — tx ${result.tx.hash}` : " (simulated)";
  const settled = await transition({ ...deal, paymentError: undefined, ...(result.tx && { payoutTx: result.tx }) }, event, `${note}${where}`);
  await kv().append(keys.ledger, {
    at: Date.now(),
    dealId: deal.id,
    event,
    amountUsd: deal.amountUsd,
    to: event === "release" ? deal.payTo : deal.buyerAddress ?? deal.buyer,
    settlement: deal.settlement,
    tx: result.tx?.hash ?? null,
  });
  return settled;
}

// -------------------------------------------------------------------- steps

export interface CreateDealInput extends DiscoveryQuery {
  buyer: string;
  task: string;
}

export interface CreateDealResult {
  deal: Deal;
  discovery: DiscoveryResult;
  /** Set when a human must approve funding before anything is locked. */
  approvalActionId?: string;
  /** Set when agents approved the deal but the payment itself failed. */
  paymentError?: string;
}

export interface CreateDealOptions {
  providers?: readonly Provider[];
  /** Reads the provider's wallet; defaults to live The Graph data. */
  checkProvider?: ProviderRiskCheck;
}

/**
 * Step 1-2: discover a provider, check its wallet on The Graph, then fund
 * escrow — or wait for a human when the amount or the wallet calls for one.
 */
export async function createDeal(input: CreateDealInput, options: CreateDealOptions = {}): Promise<CreateDealResult> {
  const providers = options.providers ?? listProviders();
  const checkProvider = options.checkProvider ?? checkProviderWallet;
  const buyer = input.buyer.trim();
  const task = input.task.trim();
  if (!buyer) throw new MarketError("INVALID_REQUEST", "buyer is required", 400);
  if (!task) throw new MarketError("INVALID_REQUEST", "task is required", 400);

  let discovery: DiscoveryResult;
  try {
    discovery = discover(providers, input);
  } catch (error) {
    throw new MarketError("NO_PROVIDER", error instanceof Error ? error.message : "No provider found", 404);
  }
  const { provider } = discovery;
  const providerRisk = await checkProvider(provider.payTo);
  const fundingReasons = fundingGate(provider.priceUsd, providerRisk);
  const needsHuman = fundingReasons.length > 0;
  const now = Date.now();
  let deal: Deal = {
    id: randomUUID(),
    buyer,
    skill: input.skill.trim().toLowerCase(),
    task,
    providerId: provider.id,
    payTo: provider.payTo,
    amountUsd: provider.priceUsd,
    status: "awaiting_approval",
    settlement: settlementRail().mode,
    buyerAddress: settlementRail().buyerAddress,
    fundingRequiresHuman: needsHuman,
    fundingReasons,
    providerRisk,
    createdAt: now,
    history: [{ at: now, event: "create", status: "awaiting_approval", note: discovery.reason }],
  };

  if (!needsHuman) {
    deal = await saveDeal(deal);
    try {
      deal = await lockFunds(deal, `$${deal.amountUsd} is within the limit and no gate was triggered — agents approved it without a human; funds locked in escrow`);
      return { deal, discovery };
    } catch (error) {
      if (!(error instanceof MarketError)) throw error;
      // Keep the deal so it can be seen and retried; the error says why it is not funded.
      return { deal: (await getDeal(deal.id)) ?? deal, discovery, paymentError: error.message };
    }
  }

  const action = approvalAction(
    deal,
    "fund",
    `Lock $${deal.amountUsd} in escrow for ${provider.name}: ${task}`,
    fundingReasons,
  );
  await savePendingAction(action);
  deal = await saveDeal({ ...deal, fundingActionId: action.id });
  return { deal, discovery, approvalActionId: action.id };
}

/**
 * Step 2: lock the funds. For large deals only after a human approved with
 * Selfie Check; for small deals this retries a payment that failed before
 * anything was sent.
 */
export async function confirmFunding(dealId: string): Promise<Deal> {
  const deal = await requireDeal(dealId);
  if (deal.status !== "awaiting_approval") throw new MarketError("INVALID_TRANSITION", `Deal is already ${deal.status}`, 409);
  if (!deal.fundingRequiresHuman) return lockFunds(deal, "Retried by the agents; funds locked in escrow");
  // A receipt is consumed once and remembered on the deal, so a payment that
  // failed before sending can be retried without a second Selfie Check.
  let approved = deal;
  if (!deal.fundingApprovedBy) {
    const receipt = await consumeApproval(deal.fundingActionId);
    approved = await saveDeal({ ...deal, fundingApprovedBy: receipt.credentialType === "selfie_check" ? "Selfie Check" : receipt.credentialType });
  }
  return lockFunds(approved, `Human approved with ${approved.fundingApprovedBy}; $${deal.amountUsd} locked in escrow`);
}

/** Step 3: the provider hands in its work (typed in by a person). */
export async function deliver(dealId: string, output: string, by: "provider_agent" | "manual" = "manual", note = "Provider delivered its result (entered manually)"): Promise<Deal> {
  const text = output.trim();
  if (!text) throw new MarketError("INVALID_REQUEST", "output is required", 400);
  const deal = await requireDeal(dealId);
  const delivered = await transition(deal, "deliver", note);
  return saveDeal({ ...delivered, output: text.slice(0, 8000), deliveredBy: by });
}

/** Step 3, autonomous: the provider's own agent does the job and delivers it. */
export async function performWork(dealId: string, options: WorkerOptions = {}): Promise<Deal> {
  const deal = await requireDeal(dealId);
  if (deal.status !== "funded") throw new MarketError("INVALID_TRANSITION", `The provider starts only once funds are in escrow; this deal is ${deal.status}`, 409);
  const provider = getProvider(deal.providerId);
  if (!provider) throw new MarketError("NO_PROVIDER", `Provider ${deal.providerId} is no longer in the catalog`, 404);
  const result = await doWork(provider, deal.skill, deal.task, options);
  if (!result.ok) throw new MarketError("PROVIDER_FAILED", `${provider.name} could not do the job: ${result.reason}`, 502);
  return deliver(dealId, result.output, "provider_agent", result.via === "apify" ? `${provider.name} ran an Apify Actor (${result.model}) and delivered a report with sources` : `${provider.name}'s agent did the job (${result.model}) and delivered it`);
}

export interface JudgeDealResult {
  deal: Deal;
  verdict: Verdict;
  /** Set when the outcome waits for a human Selfie Check. */
  approvalActionId?: string;
}

/** Step 4-5: the judge checks the delivery; escrow releases, refunds or escalates. */
export async function judgeDeal(dealId: string, options: JudgeOptions = {}): Promise<JudgeDealResult> {
  const deal = await requireDeal(dealId);
  if (deal.status !== "delivered") throw new MarketError("INVALID_TRANSITION", `Only a delivered deal can be judged; this one is ${deal.status}`, 409);
  const verdict = await judge({ task: deal.task, output: deal.output ?? "" }, options);
  const judged = await saveDeal({ ...deal, verdict });
  const outcome = settle(verdict, deal.amountUsd);

  if (outcome.kind === "release") return { deal: await payOut(judged, "release", `Judge accepted: ${verdict.reason}`), verdict };
  if (outcome.kind === "refund") return { deal: await payOut(judged, "refund", `Judge rejected: ${verdict.reason}`), verdict };

  const disputed: Deal = { ...judged, proposedOutcome: outcome.proposed };
  const action = approvalAction(
    disputed,
    "dispute",
    `${outcome.proposed === "release" ? "Pay" : "Refund"} $${deal.amountUsd} for: ${deal.task}`,
    [outcome.why, `Judge: ${verdict.verdict} — ${verdict.reason}`],
  );
  await savePendingAction(action);
  const escalated = await transition({ ...disputed, disputeActionId: action.id }, "escalate", `Escalated to a human: ${outcome.why}`);
  return { deal: escalated, verdict, approvalActionId: action.id };
}

/** Step 5 for disputes: apply the proposed outcome once a human approved it. */
export async function resolveDispute(dealId: string): Promise<Deal> {
  const deal = await requireDeal(dealId);
  if (deal.status !== "disputed" || !deal.proposedOutcome) throw new MarketError("INVALID_TRANSITION", `Deal is ${deal.status}, not disputed`, 409);
  let approved = deal;
  if (!deal.disputeApprovedBy) {
    const receipt = await consumeApproval(deal.disputeActionId);
    approved = await saveDeal({ ...deal, disputeApprovedBy: receipt.credentialType === "selfie_check" ? "Selfie Check" : receipt.credentialType });
  }
  return payOut(approved, deal.proposedOutcome, `Human confirmed with ${approved.disputeApprovedBy}: ${deal.proposedOutcome}`);
}

/** Buyer withdraws before anything was locked. */
export async function cancelDeal(dealId: string): Promise<Deal> {
  const deal = await requireDeal(dealId);
  return transition(deal, "cancel", "Buyer cancelled before funding");
}

/** API view of a deal: adds where the money is, in plain words. */
export function present(deal: Deal) {
  return { ...deal, funds: describeFunds(deal), done: isTerminal(deal.status) };
}
