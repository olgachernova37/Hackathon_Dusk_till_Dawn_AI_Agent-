import { kv, RETENTION_SECONDS } from "../kv.ts";
import type { AgentAction, HumanGateReceipt } from "../types.ts";
import { hashAction } from "./hash.ts";

const replayKey = (actionId: string) => `replay:${actionId}`;

/**
 * Validate once and claim the action so a receipt cannot be replayed.
 *
 * ONE-SHOT: a successful call consumes the action. Call it exactly once, right
 * before spending (execute.ts does) — calling it again throws "already executed".
 *
 * The claim is an atomic setIfAbsent, so two concurrent executions of the same
 * action cannot both pass. (The previous read-check-write on a JSON file left a
 * window where they could.)
 */
export async function assertValidReceipt(receipt: HumanGateReceipt, action: AgentAction): Promise<void> {
  if (receipt.expiresAt <= Date.now()) throw new Error("Receipt expired");
  if (receipt.actionId !== action.id) throw new Error("Receipt actionId mismatch");

  const expectedHash = hashAction(action.payload);
  if (receipt.actionHash !== expectedHash) throw new Error("Receipt actionHash mismatch");

  const claimed = await kv().setIfAbsent(replayKey(action.id), Date.now(), { ttlSeconds: RETENTION_SECONDS });
  if (!claimed) throw new Error("Action already executed");
}
