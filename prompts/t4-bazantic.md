# T4 — Bazantic gateway + x402 + recipe · copy-paste agent prompt

Worktree: `/workspaces/matching-t4` · branch `feat/t4-bazantic` (already created from integrated main)

---

You are building the payments and agent-integration layer for a hackathon project (ETHOnline 2026,
deadline Sunday 13 Sep 09:00 EDT). This is the surface for **Bazantic's "Best Recipe that uses
EthGlobal Sponsor APIs" prize**.

**Your working directory is `/workspaces/matching-t4`.** Run `npm install` first (fresh directory).
**Read `PLAN.md` §0 (the Bazantic section), §1 and §3 before starting.**

## The project

"Human-Gated AI Copilot": an agent reads live on-chain data via The Graph, scores wallet risk, and
proposes actions. Risky or paid actions need a human's World ID Selfie Check, bound to the exact
payload, before anything executes.

## ⚠️ Read this first: what is known and what is not

**Known and buildable now:** our own public API, the OpenAPI spec for it, the x402 client logic, and
a draft recipe.

**NOT known yet:** the human is still setting up the Bazantic account. So we don't yet know:
- what's in the **Bazantic catalog** (which decides the recipe's second service)
- Bazantic's **exact recipe file format**
- which **network x402 settles on** (Base Sepolia vs. mainnet), or whether a funded wallet exists

**Build everything buildable, against the public x402 spec. Mark every guess with a
`// TODO(bazantic): …` comment. Don't invent Bazantic API details and present them as fact.** A
confident guess costs more to find and fix than an honest TODO.

## Files you OWN
- `src/lib/bazantic/**`, **including `src/lib/bazantic/index.ts`** (a barrel; the agent layer
  imports `../bazantic/index.ts` directly)
- `src/app/api/gateway/**`: our public API, which Bazantic's gateway proxies
- `openapi.yaml`, `bazantic-recipes.json` (repo root)

## Files you MUST NOT edit
- `src/lib/types.ts` (**FROZEN**), `src/lib/env.ts`, `src/lib/agent/**`, `src/lib/worldid/**`, `src/lib/graph/**`
- `src/app/api/agent/**`, `src/app/api/worldid/**`, `src/app/api/graph/**`
- `src/app/dashboard/**`, `src/components/**`, `src/app/page.tsx`, `PLAN.md`, `requirements.md`

You **may import from** `src/lib/agent/store.ts` (`savePendingAction`, `getPendingAction`,
`getReceipt`, `hasExecuted`), `src/lib/agent/deps.ts` (`graphDeps`), `src/lib/worldid/hash.ts`
(`hashAction`) and `src/lib/types.ts` (`computeRequiresHuman`). **Call** them; don't edit them.

**⚠️ ALWAYS `await` every store call**, e.g. `const action = await getPendingAction(id)`, even if
the function you see is synchronous. The app is moving to Vercel, and the store is being migrated in
parallel from local files to Redis, which makes every store function async. `await` on a plain value
is harmless, so awaiting now keeps your code correct across that change. **Also, don't write to
`.data/` or the filesystem directly.** Vercel's filesystem is read-only. For the run log (Part D), use
whatever store helper exists when you get there, or write through a small function you own that I can
redirect at merge.

## Git discipline (graded)
- **Do NOT run `git checkout`, `git switch`, or `git branch`.** Sibling worktrees share this repo.
- **≥ 4 small commits with real messages.** No mono-commit. Do not merge to `main`.

## 🚨 Import rule (learned the hard way merging other tasks)
**Value imports must be relative with a `.ts` extension, not the `@/` alias.** Write
`import { savePendingAction } from "../agent/store.ts"`, not `"@/lib/agent/store"`. The agent layer
imports your module statically, and its tests run under `node --test`, where plain Node can't
resolve `@/`. `import type { … } from "@/lib/types"` is fine, because type imports are erased.
**Route files** under `src/app/api/**` may use `@/`, since only the bundler loads them.

---

## 🚨 Trap: do NOT call `assertValidReceipt` inside `runRecipe`

`PLAN.md` §5 T4 says `runRecipe` should call `assertValidReceipt` before spending. **Ignore that
line. It's outdated.** The merged code already calls it in `src/lib/agent/execute.ts`, immediately
before `runRecipe`. And `assertValidReceipt` is **one-shot**: it records the action as executed to
prevent replay. Calling it a second time throws `"Action already executed"`, so **every approved
payment would fail**.

The gate lives in `execute()`. `runRecipe` should require a `receipt` argument, and refuse
(`status: "rejected_no_receipt"`) if one is missing or has no `nullifierHash`. It must **not**
re-run the consuming validation.

---

## Part A — our public gateway API (`src/app/api/gateway/**`) — fully buildable now

This is what Bazantic's gateway proxies, so other agents can use our human gate as a service.

**`POST /api/gateway/gate`** — body `{ address: string, intent: string, costUsd?: number }`
1. Assess the address via `graphDeps()`: call `getWalletActivity` then `assessRisk`. **The Graph
   module isn't merged yet**, so `graphDeps()` currently returns a stub that **throws**. Catch that
   and return a structured `503 { error: { code: "GRAPH_UNAVAILABLE", message } }`. **Never
   substitute fake risk data.**
2. Build an `AgentAction` (`kind: "recipe_run"`, `payload` including `address` + `intent`,
   `requiresHuman` via `computeRequiresHuman(score, costUsd)`), then `savePendingAction` it.
3. Return `{ actionId, actionHash: hashAction(payload), riskScore, riskReasons, requiresHuman, approvalUrl }`.
   `approvalUrl = ${PUBLIC_BASE_URL}/dashboard?action=${actionId}`.

**`GET /api/gateway/gate?actionId=…`** → `{ status: "awaiting_human" | "approved" | "executed" | "not_found", receipt? }`.
This is how an external agent **polls** while the human approves.

**`GET /api/gateway/action?id=…`** → the stored `AgentAction`, or 404. The console's
`/dashboard?action=<id>` deep link (being built in parallel by T6b) consumes this.

**The recipe's human step is an URL.** An external agent can *prepare* an action, but it can't
*approve* one. It hands `approvalUrl` to a human, polls, and only proceeds on `approved`. That's the
whole thesis of the project, expressed as an API.

`PUBLIC_BASE_URL`: read `process.env.PUBLIC_BASE_URL`, falling back to `http://localhost:3000`.
**Don't edit `env.ts`.** List it in your final report and I'll add it at merge.

## Part B — `openapi.yaml` — fully buildable now, and **it unblocks the human**

The human uploads this spec to bazantic.com to create our x402 gateway. Bazantic's AI builds the
agent stack from it, so **spec quality is prize quality**.
- OpenAPI 3.1, the three routes above, complete request/response schemas, all error shapes.
- **Rich `description`s saying *when, why and how*** to use each operation. Bazantic's own wording
  for a recipe is one that *"explains when, why, and how to use your service."*
- `servers: [{ url: "{PUBLIC_BASE_URL}" }]` with a variable, not a hardcoded host.

## Part C — the x402 client (`src/lib/bazantic/x402.ts`) — build against the public spec

`x402-fetch` (v1.2.0, verified on npm) wraps `fetch` to handle `HTTP 402` → pay → retry. Use it
with a viem account from `process.env.X402_PRIVATE_KEY`, a **burner** wallet. **Before depending on
it, read its README in `node_modules`**, and confirm the real API rather than assuming one.

- A missing `X402_PRIVATE_KEY` must fail **loudly and specifically**, not with an opaque viem error.
- **Never log the private key**, or anything derived from it beyond the public address.
- Network: `// TODO(bazantic): Base Sepolia vs mainnet — unconfirmed.` Make it configurable.

## Part D — `runRecipe` / `listRecipes` (`src/lib/bazantic/index.ts` + friends)

`runRecipe(recipeId, input, receipt): Promise<RecipeRun>` performs the **paid** step, after
`execute()` has already validated the human's receipt.

**Match how it's already being called.** `execute.ts` on main calls
`runRecipe(action.kind === "recipe_run" ? "wallet-risk-trace" : action.kind, action.payload, receipt)`.
So the recipe id **`wallet-risk-trace`** must exist, and unknown ids must return `status: "failed"`
with a clear message.

- Recipes are config-driven from `bazantic-recipes.json`. The paid endpoint URL comes from config
  plus `BAZANTIC_GATEWAY_URL`.
- Every run, success or failure, is appended to **`.data/runs.jsonl`**: recipe id, cost, receipt
  `nullifierHash`, outcome, timestamp. This is the audit trail, and evidence for the video.
- Return per-step results in `RecipeRun.steps`, so the console can show data moving between services.

## Part E — `bazantic-recipes.json` — a draft, clearly marked as one

Draft the **"Human-gated wallet check"** recipe:

    A. The Graph   → wallet activity for the address                  (sponsor API)
    B. Our /gate   → scores A's numbers, creates the pending action,
                      returns approvalUrl                               (our gateway)
    C. Poll /gate  → until a human approves via Selfie Check

The final result, "approved by a verified human" or "blocked", **depends meaningfully on both
services**. That's the scored phrase. Without The Graph, there's no risk score to gate on. Without
our gate, there's no human decision. **The recipe must not loop back into our own execute route.**
It ends at the approval decision.

Include `whenToUse`, `why`, `how` text an agent can act on unaided. Mark the file's schema
`// TODO(bazantic): conform to Bazantic's actual recipe format once the account exists.` (JSON has no
comments, so put it in a `"_draft_note"` field.)

---

## Constraints
- **Next.js 16.3.4.** Next 16 has breaking changes vs. your training data (`AGENTS.md`). Read
  `node_modules/next/dist/docs/` before writing route handlers.
- **Gotcha:** run `npm run build` **before** `npx tsc --noEmit` in a fresh worktree. The
  `LayoutProps` error before that is not real.
- Tests with `node:test`. Test the **402 → pay → retry logic with a fake `fetch`**. That's testing our
  own control flow, which is fine. What's forbidden is fake data reaching the *shipped path*.
- TypeScript strict. `npm run build` + `npx tsc --noEmit` clean before each commit.

## Definition of done
- [ ] `POST /api/gateway/gate` creates a pending action and returns `approvalUrl`; 503 `GRAPH_UNAVAILABLE` while Graph is stubbed
- [ ] `GET /api/gateway/gate` status polling works for awaiting / approved / executed / not_found
- [ ] `GET /api/gateway/action` returns the stored action or 404
- [ ] `openapi.yaml` is complete, with when/why/how descriptions, and ready to upload
- [ ] x402 client built on the real `x402-fetch` API; loud error when the key is missing; key never logged
- [ ] `runRecipe` does **not** call `assertValidReceipt`; `wallet-risk-trace` exists; unknown ids fail cleanly
- [ ] Every run appended to `.data/runs.jsonl`
- [ ] `bazantic-recipes.json` drafted with when/why/how, marked as a draft, with no loop into execute
- [ ] `src/lib/bazantic/index.ts` barrel exists; value imports are relative `.ts`
- [ ] 402 handling unit-tested with a fake fetch
- [ ] Every unconfirmed Bazantic detail marked `TODO(bazantic)`
- [ ] `npm run build` clean, `npx tsc --noEmit` clean, tests green
- [ ] ≥ 4 commits, no files outside ownership touched

Report at the end: what's built, every `TODO(bazantic)` with what's needed to resolve it, the env
vars you need (`PUBLIC_BASE_URL`, `X402_PRIVATE_KEY`, …), and anything that blocked you.
