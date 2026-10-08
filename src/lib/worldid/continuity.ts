import { kv } from "../kv.ts";
import { CREDENTIAL_VALIDITY_DAYS, type ContinuityInfo } from "../types.ts";

type HumanRecord = { firstSeenAt: number; approvalCount: number };

const humanKey = (nullifierHash: string) => `human:${nullifierHash}`;
const dayMs = 24 * 60 * 60 * 1000;

function toContinuity(record: HumanRecord | undefined, now = Date.now(), isReturning = record ? record.approvalCount > 0 : false): ContinuityInfo {
  if (!record) {
    return { isReturning: false, firstSeenAt: now, approvalCount: 0, daysKnown: 0 };
  }

  const daysKnown = Math.min(CREDENTIAL_VALIDITY_DAYS, Math.max(0, Math.floor((now - record.firstSeenAt) / dayMs)));
  return {
    isReturning,
    firstSeenAt: record.firstSeenAt,
    approvalCount: record.approvalCount,
    daysKnown,
  };
}

/** A record that is missing or malformed is treated as absent, never as a crash. */
function asRecord(value: unknown): HumanRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { firstSeenAt, approvalCount } = value as Partial<HumanRecord>;
  return typeof firstSeenAt === "number" && typeof approvalCount === "number" ? { firstSeenAt, approvalCount } : undefined;
}

export async function getContinuity(nullifierHash: string): Promise<ContinuityInfo> {
  return toContinuity(asRecord(await kv().get(humanKey(nullifierHash))));
}

// No TTL: continuity is the point. Selfie Check's own 90-day validity window is
// applied when reporting daysKnown, not by expiring the record.
export async function recordApproval(nullifierHash: string): Promise<ContinuityInfo> {
  const existing = asRecord(await kv().get(humanKey(nullifierHash)));
  const record = existing
    ? { firstSeenAt: existing.firstSeenAt, approvalCount: existing.approvalCount + 1 }
    : { firstSeenAt: Date.now(), approvalCount: 1 };
  await kv().set(humanKey(nullifierHash), record);
  return toContinuity(record, Date.now(), Boolean(existing && existing.approvalCount > 0));
}
