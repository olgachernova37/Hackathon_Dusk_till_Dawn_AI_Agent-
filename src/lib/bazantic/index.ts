import type { HumanGateReceipt, RecipeRef, RecipeRun } from "../types.ts";
// Direct, not via agent/deps: deps.ts imports this module, so going through
// it would be a circular import. The Graph is merged, so no seam is needed.
import * as graph from "../graph/index.ts";
import { kv } from "../kv.ts";
import { findRecipe, recipes } from "./recipes.ts";
import { createPaidFetch } from "./x402.ts";

const runLogKey = "bazantic:recipe-runs";

export async function listRecipes(): Promise<RecipeRef[]> {
  return recipes;
}

export async function runRecipe(recipeId: string, input: object, receipt: HumanGateReceipt): Promise<RecipeRun> {
  const recipe = findRecipe(recipeId);
  const costUsd = recipeId === "wallet-risk-trace" ? 0.05 : 0;
  if (!recipe) return { recipeId, status: "failed", steps: [{ name: "recipe lookup", service: "Bazantic", ok: false, output: `Unknown recipe: ${recipeId}` }], costUsd };
  if (!receipt?.nullifierHash) {
    const result: RecipeRun = { recipeId, status: "rejected_no_receipt", steps: [{ name: "human approval", service: "World ID", ok: false, output: "Receipt missing" }], costUsd };
    await appendRun(recipeId, costUsd, receipt?.nullifierHash, result.status);
    return result;
  }

  if (recipeId !== "wallet-risk-trace") {
    const result: RecipeRun = { recipeId, status: "failed", steps: [{ name: "recipe lookup", service: "Bazantic", ok: false, output: `Unknown recipe: ${recipeId}` }], costUsd };
    await appendRun(recipeId, costUsd, receipt.nullifierHash, result.status);
    return result;
  }

  const address = typeof (input as Record<string, unknown>).address === "string" ? String((input as Record<string, unknown>).address) : "";
  const intent = typeof (input as Record<string, unknown>).intent === "string" ? String((input as Record<string, unknown>).intent) : `wallet-risk-trace for ${address}`;
  const activity = await graph.getWalletActivity(address);
  const assessment = graph.assessRisk(activity);
  const steps: RecipeRun["steps"] = [{ name: "wallet activity", service: "The Graph", ok: true, output: activity }, { name: "risk assessment", service: "The Graph", ok: true, output: assessment }];

  // TODO(bazantic): replace this local endpoint/config with the catalog recipe once Bazantic account access confirms its format.
  const gatewayUrl = process.env.BAZANTIC_GATEWAY_URL;
  const endpoint = process.env.BAZANTIC_RECIPE_ENDPOINT;
  if (gatewayUrl && endpoint) {
    try {
      const paidFetch = createPaidFetch();
      const response = await paidFetch(`${gatewayUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, intent, assessment }) });
      if (!response.ok) throw new Error(`Bazantic gateway HTTP ${response.status}`);
      steps.push({ name: "gateway settlement", service: "Bazantic x402", ok: true, output: await response.json() });
      const result: RecipeRun = { recipeId, status: "success", steps, costUsd };
      await appendRun(recipeId, costUsd, receipt.nullifierHash, result.status);
      return result;
    } catch (error) {
      steps.push({ name: "gateway settlement", service: "Bazantic x402", ok: false, output: error instanceof Error ? error.message : "Gateway failed" });
    }
  } else {
    steps.push({ name: "gateway settlement", service: "Bazantic x402", ok: false, output: "BAZANTIC_GATEWAY_URL or BAZANTIC_RECIPE_ENDPOINT is not configured" });
  }
  const result: RecipeRun = { recipeId, status: "failed", steps, costUsd };
  await appendRun(recipeId, costUsd, receipt.nullifierHash, result.status);
  return result;
}

async function appendRun(recipeId: string, costUsd: number, nullifierHash: string | undefined, outcome: string): Promise<void> {
  await kv().append(runLogKey, { recipeId, costUsd, nullifierHash: nullifierHash ?? null, outcome, timestamp: Date.now() });
}
