import { randomUUID } from "node:crypto";
import { computeRequiresHuman, type AgentAction, type ChatMessage } from "@/lib/types";
import { bazanticDeps, graphDeps } from "./deps";
import { savePendingAction } from "./store";

/** Provider-neutral tool definitions: `parameters` is plain JSON Schema. */
export const toolDefinitions = [
  { name: "search_subgraphs", description: "Find live Graph deployments by keyword.", parameters: { type: "object", properties: { keyword: { type: "string" } }, required: ["keyword"] } },
  { name: "query_subgraph", description: "Run a read-only GraphQL query against a deployment.", parameters: { type: "object", properties: { deploymentId: { type: "string" }, query: { type: "string" }, vars: { type: "object" } }, required: ["deploymentId", "query"] } },
  { name: "get_wallet_activity", description: "Read live wallet activity from The Graph.", parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] } },
  { name: "assess_risk", description: "Score wallet activity with the deterministic risk engine.", parameters: { type: "object", properties: { activity: { type: "object" } }, required: ["activity"] } },
  { name: "list_recipes", description: "List available Bazantic recipes without running one.", parameters: { type: "object", properties: {} } },
  {
    name: "propose_action",
    description: "Prepare an action for human approval. This never executes anything. When the action targets a wallet, put it in payload.address — the server then computes the risk score itself from live Graph data.",
    parameters: { type: "object", properties: { kind: { type: "string", enum: ["read_only", "paid_call", "recipe_run"] }, summary: { type: "string" }, payload: { type: "object" }, riskScore: { type: "number" }, riskReasons: { type: "array", items: { type: "string" } }, costUsd: { type: "number" } }, required: ["kind", "summary", "payload", "riskScore", "riskReasons", "costUsd"] },
  },
] as const;

type ToolInput = Record<string, unknown>;

/**
 * The risk score decides whether a human is pulled in, so it must come from
 * The Graph via the deterministic engine — never from the model's say-so.
 * When the payload names an address, recompute server-side and override
 * whatever the model supplied. This is what makes The Graph load-bearing.
 */
async function riskFor(payload: Record<string, unknown>, modelScore: number, modelReasons: string[]) {
  const address = typeof payload.address === "string" ? payload.address : undefined;
  if (!address) return { riskScore: modelScore, riskReasons: modelReasons };
  const graph = await graphDeps();
  const assessment = graph.assessRisk(await graph.getWalletActivity(address));
  return { riskScore: assessment.score, riskReasons: assessment.reasons };
}

export async function runTool(name: string, input: ToolInput, _messages: ChatMessage[]): Promise<unknown> {
  const graph = await graphDeps();
  switch (name) {
    case "search_subgraphs": return graph.searchSubgraphs(String(input.keyword));
    case "query_subgraph": return graph.runGraphQL(String(input.deploymentId), String(input.query), input.vars as object | undefined);
    case "get_wallet_activity": return graph.getWalletActivity(String(input.address));
    case "assess_risk": return graph.assessRisk(input.activity as never);
    case "list_recipes": return (await bazanticDeps()).listRecipes();
    case "propose_action": {
      const payload = (input.payload ?? {}) as Record<string, unknown>;
      const costUsd = Number(input.costUsd);
      const { riskScore, riskReasons } = await riskFor(payload, Number(input.riskScore), ((input.riskReasons as string[] | undefined) ?? []).map(String));
      const action: AgentAction = { id: randomUUID(), kind: input.kind as AgentAction["kind"], summary: String(input.summary), payload, riskScore, riskReasons, costUsd, requiresHuman: computeRequiresHuman(riskScore, costUsd), createdAt: Date.now() };
      // Awaited so this stays correct when the store becomes async (Redis on Vercel).
      await savePendingAction(action);
      return action;
    }
    default: throw new Error(`Unknown agent tool: ${name}`);
  }
}
