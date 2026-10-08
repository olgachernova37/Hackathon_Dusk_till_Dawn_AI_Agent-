# T2 — The Graph data layer · copy-paste agent prompt

Worktree: `/workspaces/matching-t2` · branch `feat/t2-graph` (already created, up to date with main)

---

You are building the on-chain data layer for a hackathon project (ETHOnline 2026, deadline Sunday
13 Sep 09:00 EDT). **This module is the primary surface for The Graph's $5,000 prize — our largest.**

**Your working directory is `/workspaces/matching-t2`.** Start there, run `npm install` first (fresh
directory). **Read `PLAN.md` §3 and §5 T2 before writing code.**

## The project in one paragraph

"Human-Gated AI Copilot" — a chat agent reads live on-chain data via The Graph, scores wallet risk,
and proposes actions. Risky or paid actions are blocked until a real human approves with a World ID
Selfie Check bound to the exact payload; execution runs through a Bazantic x402 gateway. **Your risk
score is what decides whether a human gets pulled in at all** — that is what makes The Graph
load-bearing rather than decorative, and "load-bearing" is the literal judging criterion.

## Files you OWN
- `src/lib/graph/**`
- `src/app/api/graph/**`
- `scripts/graph-smoke.ts` (create it)

## Files you MUST NOT edit
- `src/lib/types.ts` — **FROZEN contract.** It defines `WalletActivity`, `RiskAssessment`,
  `SubgraphRef`. Code against it. If you need a change, STOP and report it.
- `src/lib/worldid/**`, `src/lib/bazantic/**`, `src/lib/agent/**` — other agents are building these
  **right now** in sibling worktrees.
- `src/app/page.tsx`, `src/app/dashboard/**`, `src/components/**`, other `src/app/api/**` routes
- `PLAN.md`, `requirements.md`

You may add `package.json` dependencies and a `"graph:smoke"` script entry. Lockfile conflicts at
merge are expected and fine.

## Git discipline (graded)
- **Do NOT run `git checkout`, `git switch`, or `git branch`.** Sibling worktrees share this repo.
- **≥ 4 small commits with real messages.** No mono-commit. Do not merge to `main`.

---

## ✅ Verified facts — do not re-derive these

These were tested live against the real API on 2026-09-11. Trust them.

**Credentials:** `GRAPH_API_KEY` is set in `.env.local` (symlinked into your worktree) and **works**.
Read it via `serverEnv().GRAPH_API_KEY` from `src/lib/env.ts`.

**Gateway request format — the key goes in a header, NOT the URL path:**

    POST https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>
    Authorization: Bearer <GRAPH_API_KEY>
    Content-Type: application/json
    {"query": "...", "variables": {...}}

Some Graph docs still show the key embedded in the URL path. That is the older form; **use the
Bearer header**, which is what was verified.

**Primary subgraph — Uniswap V3, Ethereum mainnet (canonical Uniswap Labs deployment):**
`5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
- Has `swaps` filterable by wallet via `where: { origin: "<address>" }` — **verified working.**
- Returns `timestamp`, `amountUSD`, `origin`, `recipient`, `token0 { symbol }`, `token1 { symbol }`.
- Both checksummed and lowercase addresses match (the Graph normalises `Bytes` filters). Still
  lowercase addresses yourself for consistent cache keys and display.
- Verified test address with real history: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`.

**Secondary subgraph — Uniswap V3 positions/LP deployment:**
`8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD`
- ⚠️ **Has NO `swaps` field.** Fields: `factory, bundle, token, pool, position, positionSnapshot,
  transaction, mint, burn, collect`. Do not query swaps here — it errors.
- `mints(where: { origin: "<address>" })` works: `origin` is the real wallet; `owner` is just
  Uniswap's NonfungiblePositionManager contract (`0xc36442b4…`), so never treat `owner` as the user.
- Optional enrichment: LP activity as an extra signal. **Not required.**

**Subgraph MCP — ✅ VERIFIED WORKING.** Connected in 621ms with our key via classic SSE transport,
`@modelcontextprotocol/sdk` **1.30.0**. Exact working code and the full tool list are in Part D.

**Not usable — do not spend time on it:**
- **Token API** — its docs now redirect to Pinax's own API, which needs a *separate Pinax JWT*, not
  our Studio key. Skip it.
- `graphprotocol/subgraphs-skills` and `streamingfast/substreams-skills` are for *building* indexers.
  We *query* existing ones. Useful only as the `SKILL.md` format reference (Part F).

---

## Part A — client (`src/lib/graph/client.ts`)

`runGraphQL<T>(subgraphId, query, variables?)`:
- Bearer auth as above. 10s timeout via `AbortController`. Retry transient failures (network, 5xx,
  429) with short backoff, max 2 retries. **Do not retry GraphQL `errors`** — those are bugs.
- A response with an `errors` array must **throw with the Graph's own message included**, never
  return `undefined` data silently.
- Typed. No `any` leaking out of the module.

## Part B — wallet activity (`src/lib/graph/activity.ts`)

`getWalletActivity(address): Promise<WalletActivity>` from the primary subgraph.

- **`firstSeen`** needs its own query: `first: 1, orderBy: timestamp, orderDirection: asc`.
- **`txCount`, `totalVolumeUsd`** from recent swaps. `first` caps at **1000** — when you hit the cap,
  say so honestly in the data (don't imply 1000 is the lifetime total).
- **Timestamps are unix *seconds* as strings.** `WalletActivity.firstSeen` is a JS number — convert to
  milliseconds consistently, since the console renders it with `new Date(...)`.
- **`amountUSD` is a high-precision decimal string** — parse deliberately, don't let `NaN` through.
- **Counterparties need care.** `recipient` is often a **router contract**, not a person — the
  verified sample contained `0xe592427a0aece92de3edee1f18e0157c05861564` (Uniswap SwapRouter).
  Counting routers as counterparties produces a meaningless "top counterparty". Either exclude known
  router/aggregator addresses, or define counterparties as distinct pools/token pairs traded.
  **Pick one, document it in `SKILL.md`, and be consistent.**
- **Always populate `source: { subgraphId, queriedAt }`** with `queriedAt = Date.now()` at fetch time.
  The console renders this as the LIVE badge — it is our on-screen proof the data is not mocked.

## Part C — risk engine (`src/lib/graph/risk.ts`)

`assessRisk(activity): RiskAssessment` — **pure, deterministic, no network.** Unit-test it.

Suggested rules (tune them, but keep each one explainable):
| Signal | Points |
|---|---|
| No swap history found | +40 |
| First swap < 7 days ago | +30 |
| Fewer than 5 swaps | +20 |
| One counterparty > 80% of volume | +25 |
| Recent volume spike vs. its own history | +15 |

Cap at 100.

**Every triggered rule pushes a plain-English reason that cites the actual number and the source**,
e.g. `"First Uniswap V3 swap 3 days ago (2026-09-08) — subgraph 5zvR82Qo…"`.

**⚠️ Honesty trap — this is the one a judge will probe.** An empty result means **"no Uniswap V3 swap
history"** — it does **not** mean "this wallet is new." An old wallet that has only ever used Aave, or
a CEX, has zero Uniswap swaps. Reason strings must say exactly what was observed and nothing more:
- ✅ `"No Uniswap V3 swap history found on Ethereum mainnet"`
- ❌ `"Brand-new wallet"` / `"This address has no activity"`

Same for `firstSeen`: it is **first seen *on Uniswap V3***, not wallet creation. Label it that way.

## Part D — Subgraph MCP (`src/lib/graph/mcp.ts`) — ✅ verified, build it properly

**Why it matters:** our track is *"Best AI Tooling or AI Use Case"*. MCP lets the **agent itself**
discover subgraphs, read schemas and run queries — that is the AI-tooling story. Two roles, both
load-bearing:

| Path | Used by | Why |
|---|---|---|
| **MCP** | the agent's exploratory tools (T5 consumes these) | agent-driven discovery = the AI angle |
| **Gateway GraphQL** (Part A) | the deterministic risk path | fixed query, fast, predictable for the demo |

Keep the risk score on the Gateway path — a scripted demo must not depend on an agent choosing the
right subgraph. MCP gives the agent reach; Gateway gives the score reliability.

**Exact working connection** (verified 2026-09-11 against SDK 1.30.0 — note headers must be injected
into *both* the SSE stream and the POSTed messages, hence the custom `fetch`):

    import { Client } from "@modelcontextprotocol/sdk/client/index.js";
    import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

    const headers = { Authorization: `Bearer ${serverEnv().GRAPH_API_KEY}` };
    const transport = new SSEClientTransport(new URL("https://subgraphs.mcp.thegraph.com/sse"), {
      eventSourceInit: { fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, ...headers } }) },
      requestInit: { headers },
    });
    const client = new Client({ name: "human-gated-copilot", version: "0.1.0" });
    await client.connect(transport);

**The server's actual tools** (from `listTools()`, verbatim names and args):

| Tool | Args | Use it for |
|---|---|---|
| `search_subgraphs_by_keyword` | `keyword` | discovery → `searchSubgraphs()` |
| `get_schema_by_subgraph_id` | `subgraph_id` | schema → `getSubgraphSchema()` |
| `execute_query_by_subgraph_id` | `query, subgraph_id, variables` | agent-run queries |
| `get_top_subgraph_deployments` | `chain, contract_address` | find subgraphs indexing a contract. **Use `'mainnet'` for Ethereum**, per the tool's own description |
| `get_deployment_30day_query_counts` | `ipfs_hashes` | usage signal → `SubgraphRef.queryVolume` |
| `get_schema_by_ipfs_hash` / `get_schema_by_deployment_id` | … | alternate schema lookups |
| `execute_query_by_ipfs_hash` / `execute_query_by_deployment_id` | … | alternate query paths |

Implement at minimum `searchSubgraphs(keyword)`, `getSubgraphSchema(id)`, and
`queryViaMcp(subgraphId, query, variables)`. Also export a thin `mcpTools()` list the agent layer
(T5) can hand to the model — **name them exactly as the server does** so tool calls map 1:1.

**Connection lifecycle:** SSE holds an open stream. Reuse one connected client per server process
(lazy singleton), reconnect on failure, and `close()` cleanly. Don't open a stream per request.

**MCP tool results are text content** — parse them defensively; a malformed result must throw with
context, never return partial data as if complete.

## Part E — route + smoke test

- `GET /api/graph/activity?address=0x…` → `RiskAssessment`. Validate the address; return a
  structured 400 for garbage input and a structured 502 (with the Graph's message) for upstream
  failure — never a raw stack trace.
- `scripts/graph-smoke.ts` + `npm run graph:smoke -- <address>` hitting the real API end to end and
  printing the assessment. **This is how we prove liveness on camera** — make the output readable.

## Part F — `SKILL.md` (The Graph track asks for README or SKILL.md)

Create `SKILL.md` at the repo root **in the official Graph skills format** — match
[`graphprotocol/subgraphs-skills`](https://github.com/graphprotocol/subgraphs-skills), which opens
with this frontmatter:

    ---
    name: wallet-risk-graph
    description: This skill should be used when the user asks to assess the risk of an Ethereum
      address, check a wallet's on-chain history, or decide whether an action needs human approval…
    version: 1.0.0
    ---

The `description` follows their convention: **"This skill should be used when…"** plus concrete
trigger phrases. Matching the official format signals we read their ecosystem, and makes the skill
genuinely reusable by other agents — which the judging rewards.

Body: which subgraphs you query and why; how the data drives the risk decision (the "load-bearing"
argument); the MCP tools used and how an agent calls them; your counterparty definition; the scoring
rules; and how another agent reuses this.

---

## 🚫 Hard rule: zero mocked data in the shipped path

The Graph prize **disqualifies mocked, local or static data outright.** A `MOCK_GRAPH=1` path for
offline dev is allowed only if it is **off by default** and makes the result unmistakably labelled —
set `source.subgraphId` to something like `"MOCK — not live"` so the console's LIVE badge exposes it.
There must be no way for a fixture to render as live.

## Constraints
- **Next.js 16.3.4.** Next 16 has breaking changes vs. your training data (`AGENTS.md`). **Read the
  guide in `node_modules/next/dist/docs/` before writing the route handler.**
- **Gotcha:** in a fresh worktree `npx tsc --noEmit` fails with `Cannot find name 'LayoutProps'` until
  Next generates route types. **Run `npm run build` first, then `tsc`.** Not a real type error.
- Tests with `node:test`; Node 24 strips TS types natively — add `tsx` if `node --test` can't read `.ts`.
- TypeScript strict. `npm run build` and `npx tsc --noEmit` must pass before each commit.

## Definition of done
- [ ] `npm run graph:smoke -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` prints a real score with a live `queriedAt`
- [ ] A fresh never-used address returns a sensible high score with an **honest** "no Uniswap V3 history" reason
- [ ] `assessRisk` is pure, deterministic, and unit-tested
- [ ] Every reason cites a concrete number and the source subgraph
- [ ] Router contracts don't appear as "top counterparties"
- [ ] `source.subgraphId` + `source.queriedAt` populated on every live result
- [ ] Route returns structured 400/502 errors
- [ ] MCP client connects, reuses one connection, and `searchSubgraphs("uniswap")` returns real results
- [ ] `mcpTools()` exported with the server's exact tool names, ready for the agent layer
- [ ] Risk score stays on the deterministic Gateway path
- [ ] `SKILL.md` written in the official frontmatter format
- [ ] No mock path reachable by default
- [ ] `npm run build` clean, `npx tsc --noEmit` clean, tests green
- [ ] ≥ 4 commits, no files outside ownership touched

Report at the end: what you built, which MCP tools you wired, your counterparty definition, and any
contract change you wanted in `src/lib/types.ts` but did not make.
