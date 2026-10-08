import { performWork, present } from "@/lib/market";
import { handleError, readJson, requireString } from "@/lib/market/http";

/** POST { dealId } — the provider's own agent does the job and delivers it. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ deal: present(await performWork(requireString(body, "dealId"))) });
  } catch (error) {
    return handleError(error);
  }
}
