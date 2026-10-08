/**
 * ============================================================================
 *  THE SHARED CONTRACT  —  see PLAN.md §3
 * ============================================================================
 *  This file is FROZEN. Tasks T2-T8 code against it and must not edit it.
 *  If you need a change here, stop and report it to the human, who applies it
 *  centrally. Editing this file in a task branch will break the other agents.
 * ============================================================================
 */

// ---------------------------------------------------------------- Core action

export type ActionKind = "read_only" | "paid_call" | "recipe_run";

export interface AgentAction {
  id: string;
  kind: ActionKind;
  /** Human-readable, shown verbatim in the gate dialog before approval. */
  summary: string;
  /** Canonicalised then hashed to produce the World ID `signal`. */
  payload: Record<string, unknown>;
  /** 0-100, derived from live The Graph data. */
  riskScore: number;
  /** Each reason cites real on-chain evidence, e.g. "Wallet first seen 3 days ago". */
  riskReasons: string[];
  /** 0 for read_only. */
  costUsd: number;
  /** Derived: riskScore >= RISK_GATE_THRESHOLD || costUsd > 0 */
  requiresHuman: boolean;
  createdAt: number;
}

/** The single knob that decides when a human is pulled into the loop. */
export const RISK_GATE_THRESHOLD = 50;

export function computeRequiresHuman(riskScore: number, costUsd: number): boolean {
  return riskScore >= RISK_GATE_THRESHOLD || costUsd > 0;
}

// ------------------------------------------------------------ The human gate

export type CredentialType = "selfie_check" | "device" | "orb";

/**
 * Continuity signal (PLAN.md §1). Selfie Check confirms a returning user is the
 * same person for 90 days, so a recurring nullifier means a known human.
 */
export interface ContinuityInfo {
  isReturning: boolean;
  firstSeenAt: number;
  approvalCount: number;
  daysKnown: number;
}

export interface HumanGateReceipt {
  actionId: string;
  /** 0x… keccak256(canonicalJson(action.payload)) — the World ID `signal`. */
  actionHash: string;
  /** From the World ID proof; also the anti-sybil / continuity key. */
  nullifierHash: string;
  credentialType: CredentialType;
  verifiedAt: number;
  /** verifiedAt + RECEIPT_TTL_MS. Receipts are single-action and short-lived. */
  expiresAt: number;
  continuity?: ContinuityInfo;
}

export const RECEIPT_TTL_MS = 5 * 60 * 1000;

/** Selfie Check credential validity — the continuity window. */
export const CREDENTIAL_VALIDITY_DAYS = 90;

/** Signed server-side; never construct this on the client. */
export interface RpContext {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
}

// -------------------------------------------------------------- The Graph

export interface SubgraphRef {
  subgraphId: string;
  name: string;
  /** 30-day query volume, when the MCP reports it. */
  queryVolume?: number;
}

export interface WalletActivity {
  address: string;
  firstSeen: number | null;
  txCount: number;
  uniqueCounterparties: number;
  totalVolumeUsd: number;
  topCounterparties: { address: string; count: number }[];
  /** Provenance — rendered in the UI as proof the data is LIVE, not mocked. */
  source: { subgraphId: string; queriedAt: number };
}

export interface RiskAssessment {
  score: number;
  reasons: string[];
  evidence: WalletActivity;
}

// --------------------------------------------------------------- Bazantic

export interface RecipeRef {
  recipeId: string;
  name: string;
  /** The when / why / how guidance an agent reads to use this unaided. */
  description: string;
}

export interface RecipeStep {
  name: string;
  service: string;
  ok: boolean;
  output: unknown;
}

export interface RecipeRun {
  recipeId: string;
  status: "success" | "failed" | "rejected_no_receipt";
  steps: RecipeStep[];
  costUsd: number;
  /** x402 settlement reference, when the gateway returns one. */
  txHash?: string;
}

// ------------------------------------------------------------------- Chat

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  action?: AgentAction;
  receipt?: HumanGateReceipt;
  result?: RecipeRun;
}
