import type { RiskAssessment, WalletActivity } from "@/lib/types";
// Relative value import: this module is loaded by `node --test` via the agent layer.
import { RISK_GATE_THRESHOLD } from "../types.ts";

function subgraphLabel(activity: WalletActivity): string {
  return `subgraph ${activity.source.subgraphId}`;
}

export function assessRisk(activity: WalletActivity): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];
  const source = subgraphLabel(activity);

  // No evidence is not evidence of safety. Scoring it exactly at the gate
  // threshold means "a human decides" — never a green LOW badge on a wallet we
  // know nothing about. It is also not evidence of danger (an old wallet that
  // only ever used Aave has no Uniswap swaps), so the reason says only what
  // was observed.
  if (activity.txCount === 0) {
    score += RISK_GATE_THRESHOLD;
    reasons.push(`No Uniswap V3 swap history found on Ethereum mainnet — not enough evidence to clear automatically — ${source}`);
  }
  if (activity.firstSeen !== null) {
    const ageDays = Math.max(0, Math.floor((Date.now() - activity.firstSeen) / 86_400_000));
    if (ageDays < 7) {
      score += 30;
      reasons.push(`First Uniswap V3 swap ${ageDays} days ago (${new Date(activity.firstSeen).toISOString().slice(0, 10)}) — ${source}`);
    }
  }
  // Thin history only. Zero swaps is already covered above; counting it here too
  // scored one observation twice and printed a redundant "Only 0 swaps" reason.
  if (activity.txCount > 0 && activity.txCount < 5) {
    score += 20;
    reasons.push(`Only ${activity.txCount} Uniswap V3 swaps observed (fewer than 5; sample is capped at 1000) — ${source}`);
  }
  const top = activity.topCounterparties[0];
  if (top && activity.txCount > 0 && top.count / activity.txCount > 0.8) {
    score += 25;
    reasons.push(`Top non-router counterparty accounts for ${top.count}/${activity.txCount} observed swaps — ${source}`);
  }
  return { score: Math.min(100, score), reasons, evidence: activity };
}