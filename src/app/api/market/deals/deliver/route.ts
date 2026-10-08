import { deliver, present } from "@/lib/market";
import { handleError, readJson, requireString } from "@/lib/market/http";

/** POST { dealId, output } — the provider agent hands in its work. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ deal: present(await deliver(requireString(body, "dealId"), requireString(body, "output"))) });
  } catch (error) {
    return handleError(error);
  }
}
