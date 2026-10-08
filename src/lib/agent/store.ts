import type { AgentAction, HumanGateReceipt } from "@/lib/types";
// Relative, not "@/lib/kv": this module is loaded by `node --test`, which
// cannot resolve the bundler-only alias.
import { kv, RETENTION_SECONDS } from "../kv.ts";

/*
 * Pending actions, issued receipts and completed executions — the single
 * store shared by /api/agent/plan, /api/worldid/verify, /api/agent/execute and
 * the public gateway. Read-through every time, never cached in memory: on
 * Vercel consecutive requests may run on different instances.
 */
const keys = {
  action: (id: string) => `action:${id}`,
  receipt: (actionId: string) => `receipt:${actionId}`,
  executed: (actionId: string) => `executed:${actionId}`,
};
const retain = { ttlSeconds: RETENTION_SECONDS };

export async function savePendingAction(action: AgentAction): Promise<void> {
  await kv().set(keys.action(action.id), action, retain);
}

export async function getPendingAction(id: string): Promise<AgentAction | undefined> {
  return kv().get<AgentAction>(keys.action(id));
}

export async function saveReceipt(receipt: HumanGateReceipt): Promise<void> {
  await kv().set(keys.receipt(receipt.actionId), receipt, retain);
}

export async function getReceipt(actionId: string): Promise<HumanGateReceipt | undefined> {
  return kv().get<HumanGateReceipt>(keys.receipt(actionId));
}

export async function markExecuted(actionId: string): Promise<void> {
  await kv().set(keys.executed(actionId), Date.now(), retain);
}

export async function hasExecuted(actionId: string): Promise<boolean> {
  return (await kv().get<number>(keys.executed(actionId))) !== undefined;
}
