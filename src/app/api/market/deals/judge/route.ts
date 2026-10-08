import { judgeDeal, present } from "@/lib/market";
import { approvalUrl, handleError, readJson, requireString } from "@/lib/market/http";

/**
 * POST { dealId } — the judge compares order and delivery. Small, confident
 * verdicts settle at once; large or uncertain ones return a Selfie Check link.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const result = await judgeDeal(requireString(body, "dealId"));
    return Response.json({
      deal: present(result.deal),
      verdict: result.verdict,
      requiresHuman: Boolean(result.approvalActionId),
      ...(result.approvalActionId && { approvalActionId: result.approvalActionId, approvalUrl: approvalUrl(request, result.approvalActionId) }),
    });
  } catch (error) {
    return handleError(error);
  }
}
