import { confirmFunding, present } from "@/lib/market";
import { handleError, readJson, requireString } from "@/lib/market/http";

/** POST { dealId } — lock a large deal's funds after its Selfie Check passed. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ deal: present(await confirmFunding(requireString(body, "dealId"))) });
  } catch (error) {
    return handleError(error);
  }
}
