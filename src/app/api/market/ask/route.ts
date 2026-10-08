import { createDeal, listSkills, present, understand } from "@/lib/market";
import { approvalUrl, errorResponse, handleError, readJson, requireString } from "@/lib/market/http";

/**
 * POST { message, buyer? } — the buyer agent reads a request in plain words,
 * turns it into an order, and opens a deal (discovery, Graph check, escrow
 * or a Selfie Check link) exactly as POST /api/market/deals does.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const message = requireString(body, "message");
    const buyer = typeof body.buyer === "string" && body.buyer.trim() ? body.buyer : "buyer-agent";
    const understood = await understand(message, listSkills());
    if (!understood.ok) return errorResponse("NOT_UNDERSTOOD", understood.reason, 422);
    const { order } = understood;
    const result = await createDeal({ buyer, skill: order.skill, task: order.task, maxPriceUsd: order.maxPriceUsd, strategy: order.strategy });
    return Response.json({
      order,
      deal: present(result.deal),
      discovery: { chosen: result.discovery.provider, candidates: result.discovery.candidates, reason: result.discovery.reason },
      requiresHuman: Boolean(result.approvalActionId),
      ...(result.approvalActionId && { approvalActionId: result.approvalActionId, approvalUrl: approvalUrl(request, result.approvalActionId) }),
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
