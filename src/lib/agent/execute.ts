import type { AgentAction, HumanGateReceipt, RecipeRun } from "@/lib/types";
import { bazanticDeps, worldDeps } from "./deps.ts";
import { hasExecuted, markExecuted } from "./store.ts";

export async function execute(action: AgentAction, receipt?: HumanGateReceipt): Promise<RecipeRun> {
  if (action.requiresHuman && !receipt) throw new Error("Blocked: human approval receipt required before execution");
  if (!receipt) throw new Error("Blocked: execution requires a valid human approval receipt");
  if (await hasExecuted(action.id)) throw new Error("Blocked: action has already been executed");

  const world = await worldDeps();
  // MUST be awaited. Un-awaited, a rejected validation becomes a floating
  // promise and execution falls through to runRecipe: the gate fails OPEN.
  // execute.test.ts pins this with an invalid-receipt case.
  await world.assertValidReceipt(receipt, action);
  const result = await (await bazanticDeps()).runRecipe(action.kind === "recipe_run" ? "wallet-risk-trace" : action.kind, action.payload, receipt);
  await markExecuted(action.id);
  return result;
}