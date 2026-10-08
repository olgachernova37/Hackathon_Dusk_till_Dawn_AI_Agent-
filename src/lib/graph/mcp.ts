import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { serverEnv } from "../env.ts";
import type { SubgraphRef } from "@/lib/types";

type McpContent = { type?: string; text?: string };
type McpResult = { content?: McpContent[]; structuredContent?: unknown };

let clientPromise: Promise<Client> | undefined;

async function connectClient(): Promise<Client> {
  const headers = { Authorization: `Bearer ${serverEnv().GRAPH_API_KEY}` };
  const transport = new SSEClientTransport(new URL("https://subgraphs.mcp.thegraph.com/sse"), {
    eventSourceInit: {
      fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, ...headers } }),
    },
    requestInit: { headers },
  });
  const client = new Client({ name: "human-gated-copilot", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

async function getClient(): Promise<Client> {
  clientPromise ??= connectClient().catch((error) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await (await getClient()).callTool({ name, arguments: args }) as McpResult;
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
  if (!text) throw new Error(`MCP ${name} returned no text content`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function unwrap(value: unknown, operation: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["subgraphs", "results", "deployments", "data"]) if (Array.isArray(record[key])) return record[key];
  }
  throw new Error(`MCP ${operation} returned an unexpected result shape`);
}

export async function searchSubgraphs(keyword: string): Promise<SubgraphRef[]> {
  const raw = unwrap(await callTool("search_subgraphs_by_keyword", { keyword }), "search_subgraphs_by_keyword");
  return raw.map((item) => {
    if (!item || typeof item !== "object") throw new Error("MCP search returned a malformed subgraph");
    const record = item as Record<string, unknown>;
    const subgraphId = String(record.subgraphId ?? record.subgraph_id ?? record.deployment_id ?? "");
    if (!subgraphId) throw new Error("MCP search result has no subgraph id");
    return { subgraphId, name: String(record.name ?? record.display_name ?? subgraphId), ...(record.queryVolume === undefined ? {} : { queryVolume: Number(record.queryVolume) }) };
  });
}

export async function getSubgraphSchema(subgraphId: string): Promise<unknown> {
  return callTool("get_schema_by_subgraph_id", { subgraph_id: subgraphId });
}

export async function queryViaMcp(subgraphId: string, query: string, variables?: object): Promise<unknown> {
  return callTool("execute_query_by_subgraph_id", { subgraph_id: subgraphId, query, variables: variables ?? {} });
}

export function mcpTools() {
  return [
    "search_subgraphs_by_keyword",
    "get_schema_by_subgraph_id",
    "execute_query_by_subgraph_id",
    "get_top_subgraph_deployments",
    "get_deployment_30day_query_counts",
    "get_schema_by_ipfs_hash",
    "get_schema_by_deployment_id",
    "execute_query_by_ipfs_hash",
    "execute_query_by_deployment_id",
  ] as const;
}

export async function closeMcp(): Promise<void> {
  const client = clientPromise ? await clientPromise.catch(() => undefined) : undefined;
  clientPromise = undefined;
  if (client) await client.close();
}