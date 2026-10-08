import { kv, RETENTION_SECONDS } from "../kv.ts";

/**
 * Hard spending caps for the buyer agent, enforced in code before any money
 * is locked — never in a prompt:
 *   MARKET_MAX_PAYMENT_USD  per payment (default 5)
 *   MARKET_DAILY_CAP_USD    per UTC day  (default 10)
 *
 * Known limit: the daily total is a read-then-write on the key-value store,
 * so two payments in the same instant could both pass. Each single payment
 * is still capped, and payouts are separately claimed at most once.
 */
function capFrom(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function spendCaps(): { perPaymentUsd: number; dailyUsd: number } {
  return { perPaymentUsd: capFrom("MARKET_MAX_PAYMENT_USD", 5), dailyUsd: capFrom("MARKET_DAILY_CAP_USD", 10) };
}

const dayKey = (now = new Date()) => `market:spent:${now.toISOString().slice(0, 10)}`;
const micro = (usd: number) => Math.round(usd * 1_000_000);

export async function spentToday(): Promise<number> {
  return ((await kv().get<number>(dayKey())) ?? 0) / 1_000_000;
}

export type SpendDecision = { ok: true } | { ok: false; reason: string };

/** Reserves the amount against today's cap, or explains why it is refused. */
export async function reserveSpend(amountUsd: number): Promise<SpendDecision> {
  const caps = spendCaps();
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { ok: false, reason: "Amount must be positive" };
  if (amountUsd > caps.perPaymentUsd) return { ok: false, reason: `$${amountUsd} is above the hard cap of $${caps.perPaymentUsd} per payment` };
  const key = dayKey();
  const spent = (await kv().get<number>(key)) ?? 0;
  if (spent + micro(amountUsd) > micro(caps.dailyUsd)) {
    return { ok: false, reason: `Paying $${amountUsd} would pass today's hard cap of $${caps.dailyUsd} ($${spent / 1_000_000} already spent)` };
  }
  await kv().set(key, spent + micro(amountUsd), { ttlSeconds: RETENTION_SECONDS });
  return { ok: true };
}

/** Gives a reservation back when the payment was refused before sending. */
export async function releaseSpend(amountUsd: number): Promise<void> {
  const key = dayKey();
  const spent = (await kv().get<number>(key)) ?? 0;
  await kv().set(key, Math.max(0, spent - micro(amountUsd)), { ttlSeconds: RETENTION_SECONDS });
}
