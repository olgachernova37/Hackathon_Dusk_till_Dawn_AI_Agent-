import type { Deal, DealEvent, DealStatus } from "./types.ts";

/**
 * Escrow state machine. Pure: no storage, no clock beyond the `now` passed in.
 *
 * Money only ever leaves escrow through `release` (to the provider's bound
 * address) or `refund` (back to the buyer), and both are terminal — a deal
 * can be paid out at most once. A release is accepted only after the work was
 * delivered: paid and delivered are separate facts, never assumed from each
 * other (an idea credited to SingIt — see README.md).
 */
const TRANSITIONS: Record<DealStatus, Partial<Record<DealEvent, DealStatus>>> = {
  awaiting_approval: { approve: "funded", cancel: "cancelled" },
  funded: { deliver: "delivered", refund: "refunded" },
  delivered: { release: "released", refund: "refunded", escalate: "disputed" },
  disputed: { release: "released", refund: "refunded" },
  released: {},
  refunded: {},
  cancelled: {},
};

export const TERMINAL_STATUSES: readonly DealStatus[] = ["released", "refunded", "cancelled"];

export function isTerminal(status: DealStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function nextStatus(status: DealStatus, event: DealEvent): DealStatus {
  const next = TRANSITIONS[status][event];
  if (!next) throw new Error(`Cannot ${event} a deal that is ${status}`);
  return next;
}

/** Returns a new deal with the event applied and recorded in its history. */
export function applyEvent(deal: Deal, event: DealEvent, note: string, now = Date.now()): Deal {
  const status = nextStatus(deal.status, event);
  return { ...deal, status, history: [...deal.history, { at: now, event, status, note }] };
}

/** Where the escrowed money is right now, in plain words. */
export function describeFunds(deal: Deal): string {
  const amount = `$${deal.amountUsd}`;
  switch (deal.status) {
    case "awaiting_approval":
      return `${amount} not yet locked — waiting for approval`;
    case "funded":
    case "delivered":
    case "disputed":
      return `${amount} locked in escrow for this deal`;
    case "released":
      return `${amount} paid to ${deal.payTo}`;
    case "refunded":
      return `${amount} returned to ${deal.buyer}`;
    case "cancelled":
      return "nothing was locked";
  }
}
