import { execute } from "@/lib/agent";
import { getPendingAction, getReceipt } from "@/lib/agent/store";

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("actionId" in body) || typeof body.actionId !== "string") {
      return Response.json({ error: { code: "INVALID_REQUEST", message: "actionId is required" } }, { status: 400 });
    }
    const action = await getPendingAction(body.actionId);
    if (!action) return Response.json({ error: { code: "ACTION_NOT_FOUND", message: "Pending action not found" } }, { status: 404 });
    const receipt = await getReceipt(body.actionId);
    return Response.json(await execute(action, receipt));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed";
    const status = message.startsWith("Blocked:") ? 403 : 502;
    return Response.json({ error: { code: status === 403 ? "HUMAN_GATE_REJECTED" : "EXECUTION_FAILED", message } }, { status });
  }
}