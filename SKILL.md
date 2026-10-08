---
name: wallet-risk-graph
description: This skill should be used when the user asks to assess the risk of an Ethereum address, check a wallet's on-chain history, or decide whether an action needs human approval using live The Graph data.
version: 1.0.0
---

# Wallet Risk Graph

This skill reads Uniswap V3 Ethereum mainnet swaps from deployment `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` through Gateway GraphQL. The deterministic Gateway path is the scoring path: live swap history directly determines whether the agent proposes a human-gated action. The UI exposes the deployment ID and query timestamp as provenance.

## Data and scoring

The activity query requests up to 1000 swaps, plus a separate earliest-swap query. Timestamps are converted from Unix seconds to JavaScript milliseconds. The sample's `recipient` is often a router contract, so counterparties are defined as distinct non-router recipient addresses; known Uniswap router and position-manager addresses are excluded. This avoids treating infrastructure as a person.

Risk points are explainable and capped at 100: no observed Uniswap V3 swaps (+40), fewer than five observed swaps (+20), first observed Uniswap V3 swap within seven days (+30), and concentration above 80% of observed swaps through one non-router counterparty (+25). Reasons say what was observed and identify the subgraph; no Uniswap history is never described as wallet creation or total wallet inactivity.

## MCP exploration

The exploratory agent path uses the Graph Subgraphs MCP SSE server with a Bearer Studio key. `search_subgraphs_by_keyword`, `get_schema_by_subgraph_id`, and `execute_query_by_subgraph_id` are exposed through the singleton client; the full exact server tool list is available from `mcpTools()`. MCP discovery is intentionally separate from deterministic risk scoring so a demo does not depend on an agent selecting the right deployment.

## Reuse

Call `getWalletActivity(address)` for live normalized evidence and pass it to pure `assessRisk(activity)`. Use `searchSubgraphs`, `getSubgraphSchema`, or `queryViaMcp` when an agent needs exploratory discovery. `GET /api/graph/activity?address=...` provides the route-level contract, and `npm run graph:smoke -- <address>` prints the live assessment and provenance.
