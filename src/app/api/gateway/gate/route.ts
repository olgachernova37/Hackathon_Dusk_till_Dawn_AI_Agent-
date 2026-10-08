import { randomUUID } from "node:crypto";
import { computeRequiresHuman, type AgentAction } from "@/lib/types";
import { graphDeps } from "@/lib/agent/deps";
import { savePendingAction, getPendingAction, getReceipt, hasExecuted } from "@/lib/agent/store";
import { hashAction } from "@/lib/worldid/hash";

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as { address?: unknown; intent?: unknown; costUsd?: unknown };
    if (typeof body.address !== "string" || typeof body.intent !== "string") return errorResponse("INVALID_REQUEST", "address and intent are required", 400);
    // A malformed address is the caller's mistake (400), not an upstream outage (503).
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.address)) return errorResponse("INVALID_ADDRESS", "address must be a 20-byte Ethereum address", 400);
    const costUsd = body.costUsd === undefined ? 0.05 : Number(body.costUsd);
    if (!Number.isFinite(costUsd) || costUsd < 0) return errorResponse("INVALID_REQUEST", "costUsd must be a non-negative number", 400);
    const graph = await graphDeps();
    const activity = await graph.getWalletActivity(body.address);
    const assessment = graph.assessRisk(activity);
    const payload = { address: body.address.toLowerCase(), intent: body.intent };
    const action: AgentAction = { id: randomUUID(), kind: "recipe_run", summary: body.intent, payload, riskScore: assessment.score, riskReasons: assessment.reasons, costUsd, requiresHuman: computeRequiresHuman(assessment.score, costUsd), createdAt: Date.now() };
    await savePendingAction(action);
    // PUBLIC_BASE_URL wins when set; otherwise use the origin this request
    // arrived on (echobrief.online in production) instead of a localhost link
    // that is useless to an external agent.
    const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
    return Response.json({ actionId: action.id, actionHash: hashAction(payload), riskScore: assessment.score, riskReasons: assessment.reasons, requiresHuman: action.requiresHuman, approvalUrl: `${baseUrl.replace(/\/$/, "")}/dashboard?action=${encodeURIComponent(action.id)}` });
  } catch (error) {
    return errorResponse("GRAPH_UNAVAILABLE", error instanceof Error ? error.message : "Graph unavailable", 503);
  }
}

export async function GET(request: Request): Promise<Response> {
  const actionId = new URL(request.url).searchParams.get("actionId");
  if (!actionId) return errorResponse("INVALID_REQUEST", "actionId is required", 400);
  const action = await getPendingAction(actionId);
  if (!action) return Response.json({ status: "not_found" });
  const receipt = await getReceipt(actionId);
  if (!receipt) return Response.json({ status: "awaiting_human" });
  return Response.json({ status: await hasExecuted(actionId) ? "executed" : "approved", receipt });
}