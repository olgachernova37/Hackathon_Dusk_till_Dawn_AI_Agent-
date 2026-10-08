import { present, resolveDispute } from "@/lib/market";
import { handleError, readJson, requireString } from "@/lib/market/http";

/** POST { dealId } — apply the disputed outcome once a human approved it with Selfie Check. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ deal: present(await resolveDispute(requireString(body, "dealId"))) });
  } catch (error) {
    return handleError(error);
  }
}
