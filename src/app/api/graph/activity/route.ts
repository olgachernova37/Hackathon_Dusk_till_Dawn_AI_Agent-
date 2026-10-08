import { getWalletActivity } from "@/lib/graph/activity";
import { assessRisk } from "@/lib/graph/risk";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request): Promise<Response> {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !addressPattern.test(address)) {
    return Response.json({ error: { code: "INVALID_ADDRESS", message: "address must be a 20-byte Ethereum address" } }, { status: 400 });
  }
  try {
    return Response.json(assessRisk(await getWalletActivity(address)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Graph activity lookup failed";
    return Response.json({ error: { code: "GRAPH_UPSTREAM_FAILED", message } }, { status: 502 });
  }
}