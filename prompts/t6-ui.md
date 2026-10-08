# T6 — UI / Console · copy-paste agent prompt

Paste everything below the line into a fresh agent. Self-contained; assumes no prior context.

---

You are building the UI for a hackathon project (ETHOnline 2026, deadline Sunday 13 Sep 09:00 EDT).
Work in the existing repo at `/workspaces/Matching`. **Read `PLAN.md` first** — it is the spec.

## The project in one paragraph

"Human-Gated AI Copilot" — a chat agent that reads live on-chain data via The Graph, scores wallet
risk, and proposes actions. Any risky or paid action is blocked until a real human approves it with a
World ID **Selfie Check**, where the proof is cryptographically bound to that exact action payload
(the World ID `signal` is `keccak256` of the action). Execution then runs through a Bazantic x402
gateway that refuses to spend without a valid, matching, unexpired receipt.

## Your task: T6 (see PLAN.md §5)

Build the landing page and the operator console.

### Files you OWN (edit freely)
- `src/app/page.tsx`
- `src/app/dashboard/**`
- `src/components/**` — **except `src/components/HumanGate.tsx`**, which belongs to another agent

### Files you MUST NOT edit (other agents own these; editing them causes merge conflicts)
- `src/lib/types.ts` — **FROZEN shared contract.** Read it, code against it, never change it.
  If you genuinely need a change, STOP and report it instead of editing.
- `src/lib/env.ts`, `src/lib/graph/**`, `src/lib/worldid/**`, `src/lib/bazantic/**`, `src/lib/agent/**`
- `src/app/api/**`
- `src/components/HumanGate.tsx`
- `PLAN.md`, `requirements.md`

### Git discipline (this is graded)
- **You are already on your own branch, in your own git worktree. Do NOT run `git checkout`,
  `git switch`, or `git branch`.** Other agents are working in sibling worktrees of the same repo;
  switching branches disrupts them. Just commit where you are.
- **Make at least 4 small commits with real messages.** ETHGlobal explicitly penalises a single
  last-minute mono-commit. Do not squash your work into one commit.
- Do not merge to `main` yourself; leave the branch for the human.

## What to build

### 1. `src/app/page.tsx` — landing
Replace the current placeholder. One-sentence pitch, the 6-step flow diagram from PLAN.md §1 as
clean inline SVG (no image files, no chart library), and an "Open Console" CTA linking to
`/dashboard`. Keep it short — this page is not the product.

### 2. `src/app/dashboard/page.tsx` — the console
Three panes. Dark, dense, technical: an operator console, not a marketing page.

**Left — chat thread.** Renders `ChatMessage[]`. User and assistant turns visually distinct.

**Centre — Evidence panel.** The most important pane. Renders `RiskAssessment`:
- `WalletActivity` as compact stat tiles (txCount, uniqueCounterparties, firstSeen, totalVolumeUsd)
- the risk score 0-100 as a gauge, coloured by the `--ok` / `--warn` / `--danger` tokens
- every `riskReasons[]` entry listed with its citation
- **a prominent badge showing `source.subgraphId` and a live-updating "LIVE — queried 3s ago"**
  derived from `source.queriedAt`. This badge is how a judge sees the data is not mocked. Make it
  impossible to miss. It must tick up in real time.

**Right — Receipt trail.** Append-only audit log of `HumanGateReceipt`s: truncated `nullifierHash`,
timestamp, cost, outcome. When `receipt.continuity.isReturning` is true show
**"returning human · first approved N days ago"**; otherwise "new human". Failed/rejected executions
render as a red entry — show them, never hide them.

### 3. Pending action card
When an `AgentAction` has `requiresHuman: true`: show `summary`, `costUsd`, `riskScore`, and the
truncated action hash, with a prominent **"Approve with Selfie Check"** button.

That button must mount `<HumanGate action={action} />` imported from `src/components/HumanGate.tsx`.
**That file does not exist yet** — another agent is building it. Create a minimal local stub so your
build passes, clearly commented as a stub to be deleted on merge, and do not invest in it.

While no valid receipt exists, the Execute button is **visibly disabled with the reason spelled out**
in the UI — e.g. "Blocked: awaiting human approval". A viewer must understand the block without
narration; this is the core idea of the project and the key moment of the demo video.

### 4. Data, while the backend does not exist yet
The API routes (`/api/agent/plan`, `/api/agent/execute`, `/api/graph/activity`) are being built in
parallel and may not exist yet. Write a thin client in `src/components/_api.ts` that calls them and
falls back to fixtures in `src/components/_mocks.ts` on failure.

**When any mock is active, render a persistent amber "MOCK DATA" banner across the top of the page.**
Non-negotiable: The Graph prize disqualifies mocked data outright, so a mock that ships unnoticed
costs us a $5,000 track. Nobody must be able to demo a mock by accident.

Build fixtures for all of: low-risk wallet, high-risk wallet, pending action awaiting approval,
approved-and-executed, and rejected-without-receipt.

## Constraints

- **Next.js 16.3.4 / React 19.2.8 / Tailwind 4.** Next 16 has breaking changes versus your training
  data — `AGENTS.md` in the repo root says so. **Read the relevant guide in
  `node_modules/next/dist/docs/` before writing any route or layout.** Do not write Next from memory.
  Note `LayoutProps<"/">` typed routes already differ from older versions.
- **Tailwind only. No component library, no UI kit, no icon package.**
- Use the theme tokens already defined in `src/app/globals.css`: `bg-background`, `bg-panel`,
  `bg-panel-raised`, `border-border`, `text-foreground`, `text-muted`, and the semantic
  `text-ok` / `text-warn` / `text-danger` / `text-brand`. Do not introduce new raw hex colours.
- Desktop-first (this is a desktop web app), but must not break at 400px — panes stack when narrow.
- **Load the `dataviz` skill before building the stat tiles and the risk gauge.**
- TypeScript strict. `npm run build` and `npx tsc --noEmit` must both pass before you commit.

## Definition of done

- [ ] Landing page and three-pane console both build and render
- [ ] Full flow clickable end to end against fixtures
- [ ] LIVE badge shows subgraph id and a real, ticking elapsed time
- [ ] Disabled Execute state is self-explanatory with no narration
- [ ] Rejected-without-receipt renders visibly in the receipt trail
- [ ] Returning vs. new human distinguished in the trail
- [ ] Amber MOCK DATA banner whenever fixtures are in use
- [ ] Usable at 400px wide
- [ ] `npm run build` clean, `npx tsc --noEmit` clean
- [ ] ≥ 4 commits on `feat/t6-ui`, no files outside your ownership touched

Report at the end: what you built, anything you stubbed, and any contract change you wanted in
`src/lib/types.ts` but did not make.
