import { getPendingAction } from "@/lib/agent/store";

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: { code: "INVALID_REQUEST", message: "id is required" } }, { status: 400 });
  const action = await getPendingAction(id);
  if (!action) return Response.json({ error: { code: "ACTION_NOT_FOUND", message: "Pending action not found" } }, { status: 404 });
  return Response.json(action);
}