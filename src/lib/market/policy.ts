/**
 * When a human is pulled into a marketplace deal.
 *
 * Small deals to a provider whose wallet has a clean on-chain history run
 * agent-to-agent with no human. Anything above the amount limit, a provider
 * wallet the risk engine flags, a wallet the Graph could not read, and any
 * judgement the judge is unsure of, waits for a World ID Selfie Check.
 * A per-job spending limit like this follows SingIt's per-purchase limit
 * (github.com/bubon-ik/SingItAI, MIT) — credited in HACKATHON.md.
 */
import { RISK_GATE_THRESHOLD } from "../types.ts";
import type { ProviderRisk } from "./types.ts";

/** Deals at or below this amount are approved by the agents alone. */
export const AUTO_APPROVE_LIMIT_USD = 1;

/** Below this confidence the judge's verdict is treated as uncertain. */
export const JUDGE_MIN_CONFIDENCE = 0.7;

export function fundingRequiresHuman(amountUsd: number): boolean {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) throw new RangeError("amountUsd must be a non-negative number");
  return amountUsd > AUTO_APPROVE_LIMIT_USD;
}

/** Every reason a deal's funding needs a human; empty means agents may proceed. */
export function fundingGate(amountUsd: number, risk: ProviderRisk): string[] {
  const reasons: string[] = [];
  if (fundingRequiresHuman(amountUsd)) reasons.push(`$${amountUsd} is above the $${AUTO_APPROVE_LIMIT_USD} limit agents may spend alone`);
  if (!risk.available) {
    reasons.push("The provider's wallet history could not be read from The Graph");
  } else if (risk.score !== null && risk.score >= RISK_GATE_THRESHOLD) {
    reasons.push(`The provider's wallet scores ${risk.score}/100 on live Graph data (gate at ${RISK_GATE_THRESHOLD})`);
  }
  return reasons;
}
