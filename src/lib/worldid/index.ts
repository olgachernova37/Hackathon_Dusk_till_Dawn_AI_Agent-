/**
 * Server-side entry point for the World ID gate (PLAN.md §3).
 *
 * Re-exports modules that touch the filesystem (continuity + replay ledgers), so
 * this barrel is SERVER-ONLY. Client components must import the pure hashing
 * module directly — `@/lib/worldid/hash` — as HumanGate.tsx does, or `node:fs`
 * ends up in the browser bundle.
 */
export { canonicalJson, hashAction } from "./hash.ts";
export { getContinuity, recordApproval } from "./continuity.ts";
export { assertValidReceipt } from "./receipt.ts";
