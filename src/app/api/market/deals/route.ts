import { createDeal, getDeal, present, type DiscoveryStrategy } from "@/lib/market";
import { approvalUrl, errorResponse, handleError, optionalNumber, readJson, requireString } from "@/lib/market/http";

/**
 * POST — a buyer agent asks for a skill. We discover a provider and either
 * lock the funds in escrow (small deal) or return a Selfie Check link (large).
 *
 * Body: { buyer, skill, task, maxPriceUsd?, minRating?, strategy?: "cheapest" | "best_rated" }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const strategy = body.strategy === undefined ? undefined : body.strategy;
    if (strategy !== undefined && strategy !== "cheapest" && strategy !== "best_rated") {
      return errorResponse("INVALID_REQUEST", 'strategy must be "cheapest" or "best_rated"', 400);
    }
    const result = await createDeal({
      buyer: requireString(body, "buyer"),
      skill: requireString(body, "skill"),
      task: requireString(body, "task"),
      maxPriceUsd: optionalNumber(body, "maxPriceUsd"),
      minRating: optionalNumber(body, "minRating"),
      strategy: strategy as DiscoveryStrategy | undefined,
    });
    return Response.json({
      deal: present(result.deal),
      discovery: { chosen: result.discovery.provider, candidates: result.discovery.candidates, reason: result.discovery.reason },
      requiresHuman: Boolean(result.approvalActionId),
      ...(result.approvalActionId && { approvalActionId: result.approvalActionId, approvalUrl: approvalUrl(request, result.approvalActionId) }),
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/** GET ?id= — a deal's status, history and where its money is. */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return errorResponse("INVALID_REQUEST", "id is required", 400);
  const deal = await getDeal(id);
  if (!deal) return errorResponse("DEAL_NOT_FOUND", `No deal with id ${id}`, 404);
  return Response.json({ deal: present(deal) });
}
