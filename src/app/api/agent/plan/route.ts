import { plan } from "@/lib/agent";
import type { ChatMessage } from "@/lib/types";

// A tool loop makes several LLM round trips; on a congested free tier one call
// has been measured at 20-35s. Without this, Vercel cuts the request off at its
// default limit mid-conversation. (Hobby plans cap this; verify on deploy.)
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const messages = body && typeof body === "object" && "messages" in body && Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
    if (messages.length === 0) return Response.json({ error: { code: "INVALID_REQUEST", message: "messages must contain at least one chat message" } }, { status: 400 });
    return Response.json(await plan(messages));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent planning failed";
    return Response.json({ error: { code: "PLAN_FAILED", message } }, { status: 502 });
  }
}