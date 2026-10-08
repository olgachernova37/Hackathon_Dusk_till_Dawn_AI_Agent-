/**
 * Agent marketplace — types for discovery, escrow and the judge.
 *
 * New module for the From Dusk Till Dawn #01 hackathon (Agentic Economy track).
 * Kept separate from the frozen shared contract in `src/lib/types.ts`, which
 * this module reads but never edits.
 *
 * Settlement here is SIMULATED: escrow balances are ledger records in the KV
 * store, not on-chain funds. Every deal carries `settlement: "simulated"` so
 * the UI, the API and the demo can never present it as a real payment.
 */

/** A provider agent that sells one or more skills to buyer agents. */
export interface Provider {
  id: string;
  name: string;
  /** Skills this provider sells, e.g. "translate", "summarize". */
  skills: string[];
  /** Price per job, in USD. */
  priceUsd: number;
  /**
   * The only address this provider is ever paid at. A payout to any other
   * address is refused. (Idea credited to SingIt — see HACKATHON.md.)
   */
  payTo: string;
  /** Average rating, 0-5. */
  rating: number;
  /** Completed jobs behind the rating. */
  jobs: number;
}

export type DiscoveryStrategy = "cheapest" | "best_rated";

export interface DiscoveryQuery {
  skill: string;
  /** Hard ceiling: providers above it are never chosen. */
  maxPriceUsd?: number;
  strategy?: DiscoveryStrategy;
  /** Providers with a lower rating are skipped. */
  minRating?: number;
}

export interface DiscoveryResult {
  provider: Provider;
  /** Every provider that matched, best first — shown so the choice is auditable. */
  candidates: Provider[];
  /** Why this provider won, in plain words. */
  reason: string;
}

// ----------------------------------------------------------- provider risk

/**
 * Live evidence about the provider's payout wallet, read from The Graph
 * before any money is locked. `available: false` means the Graph could not be
 * read — which pulls in a human rather than letting the deal through.
 */
export interface ProviderRisk {
  address: string;
  available: boolean;
  /** 0-100 from the existing risk engine; null when unavailable. */
  score: number | null;
  reasons: string[];
  txCount?: number;
  firstSeen?: number | null;
  totalVolumeUsd?: number;
  /** Provenance, shown as the LIVE badge. */
  source?: { subgraphId: string; queriedAt: number };
}

export type ProviderRiskCheck = (address: string) => Promise<ProviderRisk>;

// ------------------------------------------------------------------ escrow

/**
 * Deal lifecycle:
 *
 *   awaiting_approval ──approve──▶ funded ──deliver──▶ delivered
 *          │                         │                    │
 *          └──cancel──▶ cancelled    └──refund──▶ refunded │
 *                                                          ├──release──▶ released
 *                                                          ├──refund───▶ refunded
 *                                                          └──escalate─▶ disputed
 *                                                                          ├──release──▶ released
 *                                                                          └──refund───▶ refunded
 */
export type DealStatus =
  | "awaiting_approval"
  | "funded"
  | "delivered"
  | "disputed"
  | "released"
  | "refunded"
  | "cancelled";

export type DealEvent = "approve" | "deliver" | "escalate" | "release" | "refund" | "cancel";

export interface DealHistoryEntry {
  at: number;
  event: DealEvent | "create";
  status: DealStatus;
  note: string;
}

export interface Deal {
  id: string;
  /** Who is buying — an agent or caller identifier. */
  buyer: string;
  skill: string;
  /** What the buyer asked for, verbatim. The judge compares the delivery to this. */
  task: string;
  providerId: string;
  payTo: string;
  amountUsd: number;
  status: DealStatus;
  /** Escrow is a ledger record, not on-chain funds. */
  settlement: "simulated";
  /** True when the amount or the provider's wallet risk called for a human. */
  fundingRequiresHuman: boolean;
  /** Why funding needs a human (empty when agents approved it alone). */
  fundingReasons: string[];
  /** Live Graph evidence about the provider's payout wallet. */
  providerRisk: ProviderRisk;
  /** AgentAction id for the Selfie Check that approves funding, when required. */
  fundingActionId?: string;
  /** AgentAction id for the Selfie Check that settles a dispute, when escalated. */
  disputeActionId?: string;
  /** Outcome the judge proposed when it escalated (applied only after a human approves). */
  proposedOutcome?: "release" | "refund";
  output?: string;
  /** Who produced the output: the provider's own agent, or a person typing it in. */
  deliveredBy?: "provider_agent" | "manual";
  verdict?: Verdict;
  createdAt: number;
  history: DealHistoryEntry[];
}

// ------------------------------------------------------------------- judge

export type VerdictKind = "accepted" | "rejected" | "uncertain";

export interface Verdict {
  verdict: VerdictKind;
  reason: string;
  /** 0-1, as reported by the judge. */
  confidence: number;
  /** "openai" when a model judged; "unavailable" when no model could be reached. */
  judgedBy: "openai" | "unavailable";
}

/** What happens after the judge speaks. */
export type Settlement =
  | { kind: "release" }
  | { kind: "refund" }
  | { kind: "escalate"; proposed: "release" | "refund"; why: string };
