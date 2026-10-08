import { serverEnv } from "../env.ts";

const gatewayBase = "https://gateway.thegraph.com/api/subgraphs/id";

type GraphError = { message?: string };
type GraphResponse<T> = { data?: T; errors?: GraphError[] };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runGraphQL<T>(subgraphId: string, query: string, variables?: object): Promise<T> {
  const { GRAPH_API_KEY } = serverEnv();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${gatewayBase}/${encodeURIComponent(subgraphId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${GRAPH_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      const payload = await response.json() as GraphResponse<T>;
      if (payload.errors?.length) {
        throw new Error(`GraphQL error: ${payload.errors.map((error) => error.message ?? "unknown error").join("; ")}`);
      }
      if (!response.ok) {
        throw new Error(`Graph gateway HTTP ${response.status}`);
      }
      if (payload.data === undefined) throw new Error("Graph response did not include data");
      return payload.data;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "Graph request failed";
      const retryable = message.startsWith("Graph gateway HTTP 5") || message.includes("HTTP 429") || error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
      if (!retryable || attempt === 2) throw error;
      await delay(150 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Graph request failed");
}