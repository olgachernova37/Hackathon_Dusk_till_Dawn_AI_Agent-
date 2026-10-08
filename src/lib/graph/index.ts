/**
 * Server-side entry point for The Graph data layer (PLAN.md §3).
 *
 * Two paths, both load-bearing:
 *   - Gateway GraphQL (`runGraphQL`, `getWalletActivity`) feeds the
 *     deterministic risk score, so a scripted demo never depends on the model
 *     choosing the right subgraph.
 *   - Subgraph MCP (`searchSubgraphs`, `queryViaMcp`, `mcpTools`) gives the
 *     agent its own reach: discovering subgraphs and reading schemas.
 *
 * Value imports are relative with `.ts` extensions so `node --test` can load
 * this module through the agent layer (the `@/` alias is bundler-only).
 */
export { runGraphQL } from "./client.ts";
export { getWalletActivity, PRIMARY_SUBGRAPH_ID } from "./activity.ts";
export { assessRisk } from "./risk.ts";
export { searchSubgraphs, getSubgraphSchema, queryViaMcp, mcpTools, closeMcp } from "./mcp.ts";
