# T5 — Agent orchestrator · copy-paste agent prompt

Worktree: `/workspaces/matching-t5` · branch `feat/t5-agent` (already created)

---

Second task. **Move to a new working directory: `/workspaces/matching-t5`.** It is a separate git
worktree of the same repo, already on branch `feat/t5-agent`, branched from `main` — which now
contains your merged console work. Run `npm install` there first (fresh directory, no `node_modules`).

**Read `PLAN.md` §3 and §5 T5 before starting.**

## What you are building

The agent brain that drives the console you just built. It reads on-chain evidence, proposes actions,
and — critically — **can propose but never unilaterally execute**. Execution requires a human
approval receipt issued by another module.

## Files you OWN
- `src/lib/agent/**`
- `src/app/api/agent/**`

## Files you MUST NOT create or edit
- `src/lib/types.ts` — **FROZEN contract.** Read it, code against it, never change it.
- `src/lib/graph/**`, `src/lib/worldid/**`, `src/lib/bazantic/**` — **other agents are building these
  right now, in parallel, in sibling worktrees. Do not create these files.** See "Missing
  dependencies" below for how to work without them.
- `src/app/api/graph/**`, `src/app/api/worldid/**`, `src/app/api/bazantic/**`
- `src/app/page.tsx`, `src/app/dashboard/**`, `src/components/**` — including your own earlier work.
  That is merged; leave it alone on this branch.
- `PLAN.md`, `requirements.md`

You MAY add dependencies to `package.json` (you will need `@anthropic-ai/sdk`). A lockfile conflict
at merge is expected and fine.

## Git discipline (graded)
- **Do NOT run `git checkout`, `git switch`, or `git branch`.** Three sibling worktrees share this
  repo; switching branches breaks them. You are already on the right branch.
- **≥ 4 small commits with real messages.** No mono-commit.
- Do not merge to `main` yourself.

---

## Missing dependencies — read this carefully

`src/lib/graph`, `src/lib/worldid` and `src/lib/bazantic` **do not exist yet**. Their interfaces are
specified in `PLAN.md` §3. Do not create them and do not import them statically.

Instead write `src/lib/agent/deps.ts` — a single dependency-resolution layer that attempts a guarded
dynamic `import()` of each module and falls back to a clearly-labelled local stub when it is absent:

    let graph;
    try { graph = await import("@/lib/graph"); }
    catch { graph = stubGraph; /* logs a loud warning naming the missing module */ }

Everything else in `src/lib/agent/` depends only on `deps.ts`. When the real modules land, they are
picked up with no code change. **Every stub must log a visible warning and must never be silent** —
a stub that quietly returns plausible data could reach the demo and cost us the Graph track, which
disqualifies mocked data outright.

---

## What to build

### `src/lib/agent/tools.ts`
Tool definitions for the model: `search_subgraphs`, `query_subgraph`, `get_wallet_activity`,
`assess_risk`, `list_recipes`, `propose_action`.

**`propose_action` returns an `AgentAction` and executes nothing.** Execution is a separate,
human-gated round trip. **Enforce this in code, not in the prompt** — there must be no path from the
tool loop to `runRecipe`. Treat any such path as a bug, not a convenience.

### `src/lib/agent/plan.ts`
`plan(messages: ChatMessage[]): Promise<{ reply: string; action?: AgentAction }>`

Runs the Anthropic tool-use loop with model `claude-opus-5`. Set
`requiresHuman` via `computeRequiresHuman(riskScore, costUsd)` — already exported from `types.ts`,
do not reimplement the threshold.

**Load the `claude-api` skill before writing the Anthropic integration.** Do not write the tool-use
loop from memory.

System prompt requirements:
- The agent **cites the subgraph id and the concrete numbers** behind every risk claim. No vague
  "this wallet looks risky" — it says which value from which source made it say that.
- The agent **never asserts it has done something it has only proposed.** Language like "I've sent…"
  when no receipt exists is a correctness bug, and it is exactly what a judge will probe.

### `src/lib/agent/execute.ts`
`execute(action: AgentAction, receipt?: HumanGateReceipt): Promise<RecipeRun>`

1. If `action.requiresHuman` and there is no receipt → **throw**.
2. Otherwise call `assertValidReceipt(receipt, action)` from `@/lib/worldid` (via `deps.ts`) — it
   throws on expiry, id mismatch, hash mismatch, or replay.
3. Only then call `runRecipe` from `@/lib/bazantic` (via `deps.ts`).

When the worldid module is stubbed, the stub's `assertValidReceipt` must **throw by default**, not
pass. Fail closed. A stub that fails open would let the demo appear to work while the entire security
property is absent.

### `src/lib/agent/store.ts`
In-memory `Map`s for pending actions, issued receipts, and executed action ids (replay protection),
file-persisted to `.data/` (already gitignored) so a server restart mid-demo does not lose the
session. Handle missing or corrupt files without crashing.

### Routes
- `POST /api/agent/plan` → `{ reply, action? }`
- `POST /api/agent/execute` → `RecipeRun`, or a structured error when the gate rejects

Errors must be **structured and specific** — the console renders the rejection reason, and a
"blocked because X" line is a scripted beat in the demo video.

---

## Constraints
- **⚠️ No credentials exist yet.** `.env.local` is not created, so `ANTHROPIC_API_KEY` is unset.
  `src/lib/env.ts` exposes `serverEnv()` which throws a clear naming error when a key is missing —
  use it, do not add your own env parsing. Build so everything works the moment keys land; do not
  block on them.
- **Next.js 16.3.4 / React 19.2.8.** Next 16 has breaking changes vs. your training data —
  `AGENTS.md` in the repo root says so. **Read the relevant guide in `node_modules/next/dist/docs/`
  before writing route handlers.**
- **Gotcha:** in a fresh worktree `npx tsc --noEmit` fails with `Cannot find name 'LayoutProps'`
  until Next generates route types. **Run `npm run build` first, then `tsc`.** That error is not a
  real type error.
- TypeScript strict. `npm run build` and `npx tsc --noEmit` must both pass before you commit.
- Add tests with `node:test` for anything pure — especially that `execute()` refuses without a valid
  receipt. Node 24 strips TS types natively; if `node --test` cannot read `.ts`, add `tsx` as a dev
  dependency.

## Definition of done
- [ ] `deps.ts` resolves real modules when present, loud stubs when absent, never silently
- [ ] Stubbed `assertValidReceipt` fails **closed** (throws by default)
- [ ] No code path reaches `runRecipe` from the tool loop
- [ ] `plan()` returns `{ reply, action? }`; `requiresHuman` uses `computeRequiresHuman`
- [ ] `execute()` throws without a valid receipt — covered by a test
- [ ] Store survives a process restart
- [ ] Both routes return structured errors the console can render
- [ ] System prompt enforces citation and forbids claiming un-executed work
- [ ] `npm run build` clean, `npx tsc --noEmit` clean (build first), `node --test` green
- [ ] ≥ 4 commits, no files outside your ownership created or touched

Report at the end: what you built, which modules were still stubbed, what you could not verify
without an API key, and any contract change you wanted in `src/lib/types.ts` but did not make.
