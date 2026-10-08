import { cancelDeal, present } from "@/lib/market";
import { handleError, readJson, requireString } from "@/lib/market/http";

/** POST { dealId } — the buyer withdraws a deal before anything was locked. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ deal: present(await cancelDeal(requireString(body, "dealId"))) });
  } catch (error) {
    return handleError(error);
  }
}
