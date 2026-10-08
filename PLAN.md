# PLAN.md — Human-Gated AI Copilot
### ETHOnline 2026 · Implementation plan, split into agent-sized tasks

> **Written in English on purpose** — these task blocks are meant to be pasted directly
> into coding agents as prompts. Each task has: scope, owned files, contracts, acceptance criteria.

---

## 0. Situation check (read this first)

| Fact | Value |
|---|---|
| Today | **2026-09-11 (Fri)** |
| Submission deadline | **2026-09-13, 09:00 EDT** |
| Time remaining | **~46 hours** |
| Repo state | Empty (`README.md` + `requirements.md` only) — good, satisfies *Start Fresh* |

### Corrections to `requirements.md`
1. **Bazantic prize is $1,000, not $3,000** — and it's placed, not winner-take-all. $3,000 is the
   *pool* across three tracks. We target **"🍳 Best Recipe that uses EthGlobal Hackathon Sponsor
   APIs" — $1,000 split 1st $500 / 2nd $300 / 3rd $200**. Realistic expected value is a placing, not
   the full $1,000.
   **⛔ "🤖 Help an Agent Use Your Hackathon Project" is Continuity-Track-only — we are Start Fresh,
   so we are ineligible. Do not spend a minute on its A/B prompt-comparison methodology.**
2. **Deadline timezone.** 09:00 EDT = 13:00 UTC = **16:00 Kyiv**, not 18:00. Assume 16:00 Kyiv and
   plan to be done by 12:00 Kyiv Sunday.
3. **The Graph track name** is *"Best AI Tooling or AI Use Case (From Scratch)"* — $5,000. The binding
   requirement is that The Graph must be **load-bearing**, not decorative.
4. **World prize is a $3,500 pool** split across **up to 3 teams at $1,166 each** — not a single $3,500 award.
5. **🚨 Selfie Check has TWO access gates, both with lead time.** See Task 0.1 / 0.3.
   - The credential (Beta, ID `11`) is **feature-flagged per app** — enabled only by emailing
     **developers@toolsforhumanity.com**.
   - The **Sandbox app is not in the public app stores** — install is via **TestFlight (iOS)** or a
     **private Google Play link (Android)**.

### Selfie Check — the facts that shape the design
From [credentials/11](https://docs.world.org/world-id/credentials/11) and [sandbox testing](https://docs.world.org/world-id/sandbox/testing-selfie-check):

| Property | Value | Design consequence |
|---|---|---|
| Credential ID | `11` (Beta) | — |
| Checks | **Liveness + facial similarity** | Confirms a live human *and* that a returning user is the same person |
| Returns | Proof of completed check, **not a numeric score** | Our risk score comes from The Graph; World supplies a binary human signal |
| Assurance | **Medium** — no one-person-one-account guarantee | Never claim sybil-proof. Claim *friction against automated/repeat abuse* |
| Validity | **90 days**, then re-run the camera flow | ⭐ **This is our `continuity` signal — see §1** |
| User prerequisite | World ID App only (no Orb, no passport) | Low friction is the point of the track |
| Integration | IDKit — deep link on mobile, QR on desktop | We ship **desktop web**, so users get the QR → scan with phone |

### 🖥 Platform decision (settled — do not revisit)
**The product is a desktop web app (Next.js). There is no mobile app in scope.**
The phone is *not something we build* — World ID verification always runs inside the World App,
which is Tools for Humanity's app. Our desktop page shows an IDKit **QR code**; the user scans it,
completes the face check on the phone, and the proof returns to the browser session. The phone is a
peripheral in our flow, like a hardware key.

Why desktop web:
- The three-pane console (chat + evidence panel + receipt trail) needs screen space; it does not fit a phone.
- The Graph and Bazantic tracks are judged on *visible* evidence — LIVE badge, subgraph id, step A → step B data flow. That's a dashboard.
- The QR handoff is the best shot in the video: desktop → phone → face → proof lands back in the browser makes "a human approved this" legible on camera.

**Do not build a World Mini App.** It would force the console into a phone viewport, add unfamiliar
scope with ~46h left, and weaken the Graph/Bazantic surfaces.

### 🔑 No user wallet (settled — do not revisit)
**Our app never connects an end-user wallet.** No wallet-connect, no wagmi, no RainbowKit, no
signature prompts, no seed phrases. **Do not add a wallet connection library** — it is wasted hours
and it muddies the pitch.

- Addresses the user asks about are **plain strings typed into chat**. We read *public* on-chain data
  about arbitrary addresses through The Graph; that needs no relationship with those addresses.
- The only wallets in this project are **developer-side infrastructure**:
  - **Subgraph Studio login** — Studio authenticates by wallet, so you need *a* wallet to get the
    Graph API key. **Zero funds required.** Use a fresh burner; it ends up in `.env.local`.
  - **x402 settlement** for the Bazantic gateway — **❓ OPEN QUESTION, unresolved.** Probably USDC on
    Base, possibly Base Sepolia (faucet tokens fine) or possibly mainnet (a few real cents).
    **Nobody has checked yet — that's T0.6c. Do not collect tokens before checking which network.**
- Pitch line worth using in the README and video: **the human gate is a face, not a private key.**

### 🔐 How the two World ID fields are used (get this backwards and both properties die)
| Field | Value | Job |
|---|---|---|
| `action` | constant, e.g. `"human-gate"` | Scopes the nullifier, so the same person always yields the same `nullifierHash` → our **continuity** signal |
| `signal` | `keccak256(canonical(action.payload))`, different every time | Binds the proof to the exact payload → our **tamper-proof** claim |

We never receive biometric data — World performs the camera check and returns a proof plus the
nullifier. State this plainly in the README; it is a real privacy property.

**Sandbox user-state matrix (test all three, they are what `FEEDBACK.md` is graded on):**
- **Hot** — World ID already installed → straight to face matching (or enrollment if new to Selfie Check).
- **Cold** — new user: install → create account → Selfie Check.
- **Semi-cold** — existing user reinstalling on a fresh device → account recovery → Selfie Check.

⚠️ **Semi-cold is reliable on Android but has known gaps on iOS** (invite-code redemption mid-flow),
and invite-code handling differs per platform. **Prefer an Android handset as the test/demo phone.**
This is about which phone you hold while testing — it does *not* change the product platform, which
is desktop web (see below). With only an iPhone you can still do Hot and Cold; you lose semi-cold
coverage, which costs `FEEDBACK.md` depth but not the demo. Sandbox is for integration validation
only — not production sign-off or load testing.

### Bazantic — track selection and what actually qualifies

| Track | Prize | Verdict |
|---|---|---|
| 🤖 Help an Agent Use Your Hackathon Project | $1,000 (2×$500) | **⛔ INELIGIBLE — Continuity Track only.** We're Start Fresh. |
| 🍳 **Best Recipe using EthGlobal Sponsor APIs** | $500/$300/$200 | ✅ **PRIMARY TARGET** |
| 👨‍🍳 Agentify a New API | $500/$300/$200 | 🔶 **Stretch — stackable. See below.** |

**Qualification for our primary track (all mandatory):**
1. Account on bazantic.com — and **put the username (email or GitHub handle) in the submission form**, or the recipe can't be attributed to us and we score nothing.
2. Create an **x402/MPP Gateway** in Bazantic for our project.
3. Use **at least one *other* service** that is *either* already in the Bazantic catalog *or* offered by an ETHOnline sponsor.
4. One recipe driving **both services in a single working flow**.
5. **The final result must depend meaningfully on both** — not two calls stapled together.
6. **Screen recording of the completed task start to finish**, included in the submission.

Bazantic's own example is the shape to copy: Uniswap `GET /swap` → feed the returned transactions
into 1inch Trace `GET /transaction-trace` → logs. **Output of A becomes input of B.** A judge should
be able to point at the data moving across the seam. Design for that, not for two parallel calls.

#### 🔶 The stacking opportunity (worth reading before you decide)
"Best Recipe" needs the second service to be **already on Bazantic or from a sponsor**. "Agentify"
needs a service that is **neither**. Mutually exclusive for the *same* service — but **not for the
same project**. A recipe wiring *three* services (our gateway + one sponsor API + one brand-new API)
qualifies for **both tracks**, doubling expected value for roughly +2–3h, since Bazantic claims to
build the stack from an uploaded OpenAPI spec.

**Decide this Saturday midday, not Friday.** Only take it if the primary recipe is already green.
Candidate "new" APIs (verify against the Bazantic catalog *and* the sponsor list first — "not
available when the event began" is the bar): an OFAC/sanctions screening API, an ENS metadata API,
a contract-verification API (Sourcify), or a scam-address blocklist feed. A blocklist feed slots
naturally into our risk engine, so it wouldn't be a bolt-on. **Default is NO — ship the primary.**

---

## 1. Product concept

**Human-Gated AI Copilot** — a chat agent that reads live on-chain data, proposes actions, and is
*physically incapable* of executing a consequential or paid action until a real human passes a
Selfie Check that is **cryptographically bound to that specific action**.

The three sponsors map onto three organs, so none is decorative:

| Sponsor | Role | Why it's load-bearing |
|---|---|---|
| **The Graph** | 👁 **Eyes** | Live subgraph data drives the risk score that decides *whether a gate is needed at all*. No data → no decision. |
| **World Selfie Check** | ✋ **Gate** | The World ID `signal` is set to `keccak256(canonical(action))`. The proof is not a login — it's a **per-action human approval receipt**. |
| **Bazantic** | 🤖 **Hands** | x402/MPP Gateway executes the paid multi-service Recipe. The gateway call refuses to fire without a fresh, matching receipt. |

### The one idea that wins this
Most "AI + World ID" hackathon projects verify the human **once at login**, then let the agent run
free. We bind the proof to the **action payload**. Change one byte of the transaction the agent
proposed, and the receipt no longer validates.

### Hitting the five named signals
The World track asks for Selfie Check as a **risk / eligibility / fairness / continuity /
abuse-prevention** signal. We claim three of the five, each with a specific line of code behind it —
say exactly this in the README and the video, and point at the implementation:

| Signal | How we implement it |
|---|---|
| **Abuse prevention** | An autonomous agent cannot spend via the x402 gateway without a fresh human proof bound to that exact payload. Raises the cost of automated draining from zero to one face per action. |
| **Risk** | The gate is **risk-triggered, not blanket**: `requiresHuman = riskScore >= 50 \|\| costUsd > 0`, where `riskScore` comes from live Graph data. Low-risk reads stay frictionless — which is the whole argument for a *low-friction, medium-assurance* credential. |
| **Continuity** ⭐ | Selfie Check's **90-day validity** confirms a returning user is the same person. We key the receipt trail on `nullifierHash` and record first-seen, so the audit log distinguishes **"returning human, first approved 12 days ago"** from **"new human, first approval"**. Cheap to build (we already store nullifiers for replay protection) and it demonstrates continuity literally. |

Be precise about assurance: Selfie Check is **medium-assurance and explicitly not
one-person-one-account**. Claim *friction against automated and repeated abuse* — never "sybil-proof".
Judges from World will notice the overclaim.

### End-to-end flow
```
User: "Is 0xABC… safe to send 5 ETH to?"
   │
   ├─1─ Agent → The Graph (Subgraph MCP + GraphQL) → live wallet history, counterparties, age
   ├─2─ Agent → risk engine → score 0-100 + human-readable reasons
   ├─3─ Agent → proposes AgentAction { kind: 'recipe_run', costUsd: 0.05, riskScore: 72 }
   │
   ├─4─ riskScore > threshold OR costUsd > 0  ⇒  requiresHuman = true
   │       │
   │       └─ UI shows HumanGate. signal = keccak256(canonical(action))
   │          IDKit → Selfie Check → World App (Sandbox) → proof
   │          Backend verifies proof AND that signal == hash of the pending action
   │          ⇒ HumanGateReceipt { nullifierHash, actionHash, expiresAt }
   │
   └─5─ Agent → Bazantic x402 Gateway → Recipe runs (Graph + 2nd sponsor API)
           Gateway middleware rejects if receipt missing / expired / actionHash mismatch
   │
   └─6─ UI renders result + receipt trail (audit log of who approved what, when)
```

---

## 2. Architecture

### Stack
- **Next.js 16.3.4 (App Router) + React 19.2.8 + TypeScript + Tailwind 4** — single deployable, API routes = backend.
  ⚠️ **Next 16 has breaking changes vs. model training data.** The repo's `AGENTS.md` says so and
  points at `node_modules/next/dist/docs/` — **read the relevant guide there before writing routes
  or layouts**, don't code Next from memory. Note `LayoutProps<"/">` typed routes are new here.
- **`@worldcoin/idkit`** — Selfie Check via `selfieCheckLegacy({ signal })` preset.
- **The Graph** — Subgraph MCP (`https://subgraphs.mcp.thegraph.com/sse`, `Authorization: Bearer <gateway key>`) **and** direct Gateway GraphQL as the reliable fallback path.
- **Bazantic** — hosted MCP server + x402 gateway, config in `bazantic-recipes.json`.
- **Anthropic API (`claude-opus-5`)** — agent reasoning + tool loop. *(Use latest model IDs: `claude-opus-5`, `claude-sonnet-5`.)*
- **Storage** — in-memory Map + file-backed JSON. **No database.** 46 hours.

### Repo layout (final target)
```
/
├── README.md                     # T7 — pitch, arch diagram, run instructions
├── FEEDBACK.md                   # T7 — MANDATORY for World prize
├── SKILL.md                      # T7 — MANDATORY-ish for The Graph prize
├── DEMO.md                       # T8 — video script + shot list
├── PLAN.md                       # this file
├── bazantic-recipes.json         # T4 — gateway + recipe definition
├── .env.example                  # T1
├── src/
│   ├── app/
│   │   ├── layout.tsx            # T1
│   │   ├── page.tsx              # T6 — landing + gate explainer
│   │   ├── dashboard/page.tsx    # T6 — chat UI
│   │   └── api/
│   │       ├── agent/plan/route.ts      # T5
│   │       ├── agent/execute/route.ts   # T5
│   │       ├── worldid/rp-context/route.ts # T3
│   │       ├── worldid/verify/route.ts  # T3
│   │       ├── graph/activity/route.ts  # T2
│   │       └── bazantic/run/route.ts    # T4
│   ├── components/               # T6 (+ HumanGate.tsx from T3)
│   └── lib/
│       ├── types.ts              # T1 — THE SHARED CONTRACT
│       ├── env.ts                # T1
│       ├── graph/                # T2
│       ├── worldid/              # T3
│       ├── bazantic/             # T4
│       └── agent/                # T5
└── package.json
```

---

## 3. The shared contract (`src/lib/types.ts`)

**Task 1 writes this file first. Every other agent codes against it and must not edit it.**
If an agent needs a contract change, it posts the change to the human, who applies it centrally.

```ts
// ---------- Core action model ----------
export type ActionKind = 'read_only' | 'paid_call' | 'recipe_run';

export interface AgentAction {
  id: string;                       // uuid
  kind: ActionKind;
  summary: string;                  // human-readable, shown in the gate dialog
  payload: Record<string, unknown>; // canonicalised before hashing
  riskScore: number;                // 0-100, from The Graph data
  riskReasons: string[];            // cited, each references real on-chain evidence
  costUsd: number;                  // 0 for read_only
  requiresHuman: boolean;           // derived: riskScore >= 50 || costUsd > 0
  createdAt: number;
}

// ---------- Human gate ----------
export interface HumanGateReceipt {
  actionId: string;
  actionHash: string;      // 0x… keccak256(canonicalJson(action.payload)) — the World ID `signal`
  nullifierHash: string;   // from World ID proof; also the anti-sybil key
  credentialType: string;  // 'selfie_check' | 'device' | 'orb'
  verifiedAt: number;
  expiresAt: number;       // verifiedAt + 5 min. Receipts are single-action, short-lived.
}

// ---------- The Graph ----------
export interface WalletActivity {
  address: string;
  firstSeen: number | null;
  txCount: number;
  uniqueCounterparties: number;
  totalVolumeUsd: number;
  topCounterparties: { address: string; count: number }[];
  source: { subgraphId: string; queriedAt: number }; // provenance — proves data is LIVE
}

export interface RiskAssessment {
  score: number;
  reasons: string[];
  evidence: WalletActivity;
}

// ---------- Bazantic ----------
export interface RecipeRun {
  recipeId: string;
  status: 'success' | 'failed' | 'rejected_no_receipt';
  steps: { name: string; service: string; ok: boolean; output: unknown }[];
  costUsd: number;
  txHash?: string;         // x402 settlement reference if available
}

// ---------- Chat ----------
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  action?: AgentAction;
  receipt?: HumanGateReceipt;
  result?: RecipeRun;
}
```

### Module interfaces (each agent implements exactly this surface)

```ts
// src/lib/graph/index.ts        — Task 2
export function searchSubgraphs(keyword: string): Promise<SubgraphRef[]>;
export function runGraphQL<T>(deploymentId: string, query: string, vars?: object): Promise<T>;
export function getWalletActivity(address: string): Promise<WalletActivity>;
export function assessRisk(activity: WalletActivity): RiskAssessment;

// src/lib/worldid/index.ts      — Task 3
export function hashAction(payload: Record<string, unknown>): string;   // canonical JSON → keccak256
export function buildRpContext(): Promise<RpContext>;                   // server-side signed
export function verifyAndIssueReceipt(
  rpId: string, idkitResponse: unknown, action: AgentAction
): Promise<HumanGateReceipt>;
export function assertValidReceipt(r: HumanGateReceipt, a: AgentAction): void; // throws

// src/lib/bazantic/index.ts     — Task 4
export function listRecipes(): Promise<RecipeRef[]>;
export function runRecipe(
  recipeId: string, input: object, receipt: HumanGateReceipt
): Promise<RecipeRun>;

// src/lib/agent/index.ts        — Task 5
export function plan(messages: ChatMessage[]): Promise<{ reply: string; action?: AgentAction }>;
export function execute(action: AgentAction, receipt?: HumanGateReceipt): Promise<RecipeRun>;
```

---

## 4. Task 0 — Human-only prerequisites 🔴 DO THESE RIGHT NOW

**These block everything and cannot be done by an agent. Start them before spawning any agent.**

| # | Task | Where | Notes |
|---|---|---|---|
| **0.1** | **Email developers@toolsforhumanity.com** — request the Selfie Check feature flag **and** Sandbox app access in the same message | email | ⚠️ Highest risk item, two gates in one email. Say: ETHOnline 2026, Selfie Check track, include your `app_id`, and **ask for the TestFlight / Google Play testing link**. Docs say access must be enabled "through your World point of contact **before testing begins**". Send it **first**. |
| 0.2 | Create app in [Developer Portal](https://developer.worldcoin.org) → get `app_id`, create an **action**, get API key | portal | Also note your `rp_id`. Do this before 0.1 so the email can quote the `app_id`. |
| 0.3 | Install the **Sandbox World App** on a **test phone** — **not in public app stores**: TestFlight (iOS) or private Google Play link | 📱 Android preferred | This is the verification peripheral, not the product. Android preferred for semi-cold reliability; an iPhone is acceptable (see risk register). Create test users (freely resettable). Set `environment: "sandbox"` in IDKit. |
| 0.3b | Walk all three Sandbox states once by hand — **Hot / Cold / Semi-cold** | phone | Log every papercut into `notes/worldid-friction.md` **as it happens**. This is graded `FEEDBACK.md` material and cannot be reconstructed later. |
| 0.4 | [thegraph.com/studio](https://thegraph.com/studio/apikeys/) → connect wallet → **Create API Key** | web | This one key serves both Gateway GraphQL and Subgraph MCP |
| 0.5 | Create **bazantic.com** account. **Write the username (email or GitHub handle) straight into `README.md`** | web | Mandatory in the submission form — without it the recipe isn't attributed and the track scores zero. |
| 0.6 | In Bazantic: create the **x402/MPP Gateway** for this project | web | Feed it the OpenAPI spec from Task 4. Start with a stub spec — don't wait for the final one. |
| 0.6b | **Browse the Bazantic catalog and write down what's actually in it** | web | Decides the second service for the recipe, and tells us whether the 🔶 Agentify stretch (§0) is even reachable. Cheap, do it early. |
| 0.6c | Check whether x402 settlement needs a **funded wallet**, and fund it | web | A dry gateway on Sunday morning is fatal. Find out Friday. |
| 0.7 | Anthropic API key | console | |

Write every credential into `.env.local` as soon as you have it. Tell the agents which ones are live.

### Fallback if 0.1 doesn't land in time
The track says *"Selfie Check **or a Selfie Check-compatible World ID credential flow**"* — so a
documented fallback still qualifies, provided the flow is genuinely credential-gated and the
substitution is disclosed. Ship `selfieCheckLegacy` wired with `allow_legacy_proofs: true`, degrading
to standard World ID device verification, and keep the Selfie Check code path in the repo so the
integration work is visible.

**Then write the gap up as the lead item in `FEEDBACK.md`.** Two access gates — a feature flag behind
an email and a Sandbox app outside the public stores, with no self-serve toggle for either — is
precisely the "what was confusing, missing, broken, or hard to test" feedback the prize asks for, and
it is scored. **Never fake or stub a proof and present it as real.**

---

## 5. Task breakdown for agents

### Dependency graph
```
T0 (human) ──▶ T1 (scaffold + contracts)  ◀── MUST COMPLETE BEFORE ANY OTHER AGENT STARTS
                      │
       ┌──────────┬───┴────────┬──────────┐
       ▼          ▼            ▼          ▼
      T2         T3           T4         T6        ← run these 4 in parallel
    Graph      WorldID     Bazantic      UI          (T6 uses mock data until T2/T5 land)
       └──────────┴───┬────────┴──────────┘
                      ▼
                     T5  (agent orchestrator — glues 2/3/4)
                      │
              ┌───────┴───────┐
              ▼               ▼
             T7              T8
           Docs         Demo video
```

### Parallelism rules (critical for multi-agent work)
1. **File ownership is exclusive.** Each task lists owned paths. An agent never edits a path it does not own. If it needs a change elsewhere, it reports it instead.
2. **🚨 One git WORKTREE per task — a branch is not enough.**
   Git checks out one branch per *working directory*. Two agents started in `/workspaces/Matching`
   share one tree: they see each other's half-written files, and a `git checkout` by one yanks the
   branch out from under the others. **Branch isolation without directory isolation is not
   isolation.** Before starting each agent:
   ```
   git worktree add /workspaces/matching-t2 -b feat/t2-graph main
   cd /workspaces/matching-t2 && npm install       # ~1 min, npm cache makes it cheap
   ```
   Then point that agent at `/workspaces/matching-t2` as its working directory. Merge into `main`
   as each lands, then `git worktree remove /workspaces/matching-t2`.
   Do **not** symlink `node_modules` between worktrees — one agent installing a dependency would
   silently mutate every other agent's tree.
   *(The main checkout `/workspaces/Matching` counts as one worktree, so one agent may use it.)*
3. **Commit small and often.** ETHGlobal explicitly penalises a single last-minute mono-commit. Target ≥ 4 commits per task with real messages.
4. **`src/lib/types.ts` is frozen after T1.** Only the human edits it.
5. Every agent must leave its module working standalone: if a dependency isn't merged yet, code against the interface and stub behind `process.env.MOCK_<X>=1`.

---

### ✅ T1 — Scaffold + shared contracts `[DONE — merged to main]`
> Delivered: Next 16.3.4 / React 19.2.8 / Tailwind 4, `src/lib/types.ts` (frozen contract),
> `src/lib/env.ts` (lazy server secrets + mock switches), `.env.example`, console theme tokens,
> `notes/worldid-friction.md` seeded. `npm run build` and `tsc --noEmit` both clean.
> **Branch from `main` — do not re-scaffold.** Original brief kept below for reference.

<details><summary>Original T1 brief</summary>
**Owns:** `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/lib/types.ts`, `src/lib/env.ts`, `.env.example`, `.gitignore`

**Prompt:**
> Scaffold a Next.js 15 App Router + TypeScript + Tailwind project at the repo root (`npx create-next-app@latest . --ts --tailwind --app --src-dir --no-import-alias`, keep it minimal, delete boilerplate CSS/demo content). Then create `src/lib/types.ts` containing **verbatim** the types from PLAN.md §3, and `src/lib/env.ts` which reads and validates with zod: `NEXT_PUBLIC_WLD_APP_ID`, `NEXT_PUBLIC_WLD_ACTION`, `WLD_RP_ID`, `WLD_RP_PRIVATE_KEY`, `WLD_API_KEY`, `NEXT_PUBLIC_WLD_ENV` (default `sandbox`), `GRAPH_API_KEY`, `BAZANTIC_API_KEY`, `BAZANTIC_GATEWAY_URL`, `ANTHROPIC_API_KEY`. Missing vars must produce a clear startup error naming the variable, never a silent undefined. Write `.env.example` with every key and a one-line comment on where to get it. Add `viem` (for keccak256) and `zod`. Verify `npm run build` passes, then commit.

**Acceptance:** `npm run dev` serves a blank styled page; `npm run build` clean; `src/lib/types.ts` matches §3 exactly.
</details>

---

### 🟩 T2 — The Graph data layer `[~4h · parallel]` 🏆 *primary prize surface*
**Owns:** `src/lib/graph/**`, `src/app/api/graph/activity/route.ts`

> **⚠️ Superseded by [`prompts/t2-graph.md`](prompts/t2-graph.md)** — use that. It carries facts
> verified live on 2026-09-11 that correct the brief below:
> - **Auth is `Authorization: Bearer <key>`** on `https://gateway.thegraph.com/api/subgraphs/id/<id>`,
>   not the key-in-URL-path form shown below.
> - **Primary subgraph: `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`** (canonical Uniswap V3
>   mainnet) — `swaps` filterable by `origin`, verified.
> - `8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD` is a positions/LP deployment with **no `swaps`**.
> - Token API needs a separate Pinax JWT — skip.
> - **Subgraph MCP works** (SSE, SDK 1.30.0, 621ms connect, 9 tools). MCP powers the agent's
>   discovery tools; the Gateway powers the deterministic risk score.
> - An empty result means *no Uniswap V3 history*, **not** *new wallet*. Reason strings must say so.

**Original brief (kept for reference):**
> Implement `src/lib/graph/` per the interface in PLAN.md §3.
> 1. `client.ts` — Gateway GraphQL client. Endpoint `https://gateway.thegraph.com/api/<GRAPH_API_KEY>/subgraphs/id/<subgraphId>`. Typed, with retry + 10s timeout.
> 2. `mcp.ts` — Subgraph MCP client against `https://subgraphs.mcp.thegraph.com/sse` with header `Authorization: Bearer ${GRAPH_API_KEY}`. Expose `searchSubgraphs(keyword)` (discover deployments by keyword/contract) and `getSubgraphSchema(id)`. Use the `@modelcontextprotocol/sdk` SSE transport. **If the SSE transport fights you, do not burn more than 45 minutes** — fall back to the Gateway GraphQL path for discovery and note it in SKILL.md.
> 3. `activity.ts` — `getWalletActivity(address)`: query a real, live, well-known subgraph (Uniswap V3 mainnet is a safe default) for the address's swaps/transfers. Derive `txCount`, `uniqueCounterparties`, `firstSeen`, `totalVolumeUsd`, `topCounterparties`. **Populate `source.subgraphId` and `source.queriedAt` on every result** — this is our on-screen proof that data is live, which the prize requires.
> 4. `risk.ts` — `assessRisk(activity)`: deterministic, explainable scoring. Suggested signals: wallet age < 7 days (+30), txCount < 5 (+20), single dominant counterparty > 80% of volume (+25), volume spike vs. history (+15), zero history (+40). Each triggered rule pushes a **plain-English reason string that cites the actual number** (e.g. `"Wallet first seen 3 days ago (2026-09-08)"`). Cap at 100.
> 5. `src/app/api/graph/activity/route.ts` — `GET ?address=0x…` returning `RiskAssessment`.
>
> **Hard rule: zero mocked, static or cached-fixture data in the shipped path.** The Graph prize explicitly disqualifies it. A `MOCK_GRAPH=1` env path for offline dev is fine but must be off by default and must visibly badge the UI as mock.
>
> Include `npm run graph:smoke` — a script hitting a real address end-to-end and printing the assessment, so we can prove liveness on camera.

**Acceptance:** `npm run graph:smoke 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` prints a real score with live `queriedAt`. No fixtures in the default path.

---

### 🟨 T3 — World ID / Selfie Check gate `[~4h · parallel]` 🏆 *primary prize surface*
**Owns:** `src/lib/worldid/**`, `src/app/api/worldid/**`, `src/components/HumanGate.tsx`

**Prompt:**
> Implement the human gate per PLAN.md §3.
> 1. `src/lib/worldid/hash.ts` — `hashAction(payload)`: canonicalise JSON (recursively sort keys, no whitespace, stable number formatting) then `keccak256` via `viem`. Export `canonicalJson` separately and unit-test that key order and whitespace never change the hash. **This hash is the World ID `signal` and is the heart of the project — get it right.**
> 2. `src/app/api/worldid/rp-context/route.ts` — builds and signs the `RpContext` server-side (`rp_id`, `nonce`, `created_at`, `expires_at`, `signature`) using `WLD_RP_PRIVATE_KEY`. Never expose the key to the client.
> 3. `src/components/HumanGate.tsx` — client component taking an `AgentAction`. Renders `IDKitInviteCodeRequestWidget` from `@worldcoin/idkit` with `preset={selfieCheckLegacy({ signal: hashAction(action.payload) })}`, `allow_legacy_proofs: true`, `environment={process.env.NEXT_PUBLIC_WLD_ENV}`. **Before the widget opens, show the user exactly what they are approving** — summary, cost, risk score, and the truncated action hash. This dialog is the money shot of the demo video; make it clean.
> 4. `src/app/api/worldid/verify/route.ts` — POST `{ rp_id, idkitResponse, actionId }`. Look up the pending action from the in-memory store, **recompute `hashAction` server-side and reject if it does not match the proof's signal** (never trust a client-supplied hash). Forward the complete IDKit result unmodified to `https://developer.world.org/api/v4/verify/${rp_id}`. On success return a `HumanGateReceipt` with `expiresAt = now + 5min`, and store it keyed by `actionId`.
> 5. `assertValidReceipt(receipt, action)` — throws on: expired, `actionId` mismatch, `actionHash` mismatch, or replayed `nullifierHash` for an already-executed action.
> 6. **Continuity tracking ⭐** — `continuity.ts`: persist `nullifierHash → { firstSeenAt, approvalCount }` in `.data/humans.json`. Expose `getContinuity(nullifierHash)` returning `{ isReturning, firstSeenAt, approvalCount, daysKnown }`. Attach it to every receipt so the UI can show **"returning human, first approved 12 days ago"** vs **"new human"**. Selfie Check's credential is valid **90 days**, so surface `daysKnown` against that window. This is our `continuity` signal for the prize — small, but it must actually work.
>
> **Assurance honesty:** Selfie Check is medium-assurance and explicitly **not** one-person-one-account. Any user-facing copy you write says *"raises the cost of automated and repeated abuse"*, never *"sybil-proof"* or *"one person one account"*.
>
> Handle the gated-credential case: if Selfie Check is not yet enabled for our app, the flow must degrade to standard verification without crashing, and log a clear one-line warning naming the limitation.
>
> **Test all three Sandbox user states — Hot, Cold, Semi-cold** (see PLAN.md §0). Use Android; iOS semi-cold has known invite-code gaps. For each state record: what happened, what the error text was, what you expected, what was undocumented. Append everything to `notes/worldid-friction.md` **as it happens** — T7 turns it into the graded `FEEDBACK.md` and it cannot be reconstructed from memory on Sunday.

**Acceptance:** Full Sandbox round-trip produces a valid receipt in **all three user states** (or documented failure for any that can't be reached). Tampering with one byte of `action.payload` after verification makes `assertValidReceipt` throw. A second approval by the same nullifier reports `isReturning: true`. Unit tests cover canonicalisation.

---

### 🟧 T4 — Bazantic gateway + recipe `[~4h · parallel]` 🏆 *primary prize surface*
**Owns:** `src/lib/bazantic/**`, `src/app/api/bazantic/**`, `bazantic-recipes.json`, `openapi.yaml`

**Prompt:**
> 1. `openapi.yaml` — an OpenAPI 3.1 spec for our own **Human-Gated Execution** service: `POST /gate/require` (AgentAction → pending gate + `actionHash`), `POST /gate/status` (actionId → receipt or `awaiting_human`), `POST /execute` (action + receipt → RecipeRun). This spec is what we upload to Bazantic so Baz AI builds our gateway. **Our gateway sells the gate, not the data** — keep the Graph queries as the *other* service so the two are genuinely distinct.
> 2. `bazantic-recipes.json` — one Recipe, **three steps, with a real data-dependency seam at each join** (this is the scored part):
>    ```
>    A. The Graph (SPONSOR API) ── wallet activity for the target address
>           │  output: WalletActivity { txCount, firstSeen, counterparties }
>           ▼
>    B. Our gateway /gate/require ── risk-scores A's output, decides if a human is needed
>           │  output: { riskScore, requiresHuman, actionHash }   ← derived FROM A's numbers
>           ▼
>    C. Our gateway /execute ── runs only on a valid Selfie Check receipt bound to actionHash
>           │  output: RecipeRun
>    ```
>    **Step B's input is literally step A's output, and step C cannot run without B's `actionHash`.** Remove The Graph and there is no risk score, so the gate can't decide. Remove the gate and execution is ungoverned. That's what "the final result depends meaningfully on both" means — copy Bazantic's own Uniswap→1inch example structure, where A's output is B's input.
>    Write a `whenToUse` / `why` / `how` description on the recipe: the track wording is *"a recipe that explains **when, why, and how** to use your service"*. An agent should be able to pick it up with no human present.
> 3. `src/lib/bazantic/client.ts` — `listRecipes()` and `runRecipe(recipeId, input, receipt)`. Implement **x402 payment handling**: on HTTP `402`, read the payment requirements, settle, retry. Return a `RecipeRun` with per-step results and `costUsd`.
> 4. ~~`runRecipe` calls `assertValidReceipt` before spending.~~ **⚠️ SUPERSEDED — see `prompts/t4-bazantic.md`.** The gate is enforced in `src/lib/agent/execute.ts`, which calls `assertValidReceipt` immediately before `runRecipe`. `assertValidReceipt` is **one-shot** (it records the action to block replay), so calling it again inside `runRecipe` would throw "Action already executed" on every approved payment. `runRecipe` only refuses a missing receipt. The demoable "agent tries to pay without a human" path is built in the console (T6b) against the real execute route.
> 5. `src/app/api/bazantic/run/route.ts` — thin HTTP wrapper.
>
> Log every x402 call (recipe, cost, receipt nullifier, outcome) to an append-only `runs.jsonl` — this becomes the audit trail panel in the UI and proves end-to-end agent execution for the video.
>
> **Do NOT build the A/B "same prompt with and without the Recipe" comparison.** That methodology belongs to the *Help an Agent* track, which is Continuity-only and closed to us (PLAN.md §0). It's a time sink with zero prize value here.
>
> **Record the Bazantic account username** (email or GitHub handle) in `README.md` the moment the account exists — it must go in the submission form or the recipe can't be attributed to us.

**Acceptance:** A recipe run executes all three steps against the live gateway and returns `costUsd > 0`. The run log shows **step A's output values appearing in step B's input** — screenshot this, it's the evidence that the services are genuinely chained. Running without a receipt returns `rejected_no_receipt` and spends nothing.

---

### 🟪 T5 — Agent orchestrator `[~4h · after T2/T3/T4 interfaces exist]`
**Owns:** `src/lib/agent/**`, `src/app/api/agent/**`

**Prompt:**
> Implement the agent loop in `src/lib/agent/` using the Anthropic SDK with model `claude-opus-5`.
> 1. `tools.ts` — expose to the model: `search_subgraphs`, `query_subgraph`, `get_wallet_activity`, `assess_risk`, `list_recipes`, `propose_action`. **`propose_action` never executes anything** — it only returns an `AgentAction`. Execution is a separate, human-gated round trip. Enforce this in code, not in the prompt.
> 2. `plan()` — runs the tool loop, returns `{ reply, action? }`. Set `requiresHuman = riskScore >= 50 || costUsd > 0`.
> 3. `execute()` — calls `assertValidReceipt` first, then `runRecipe`. Throws if no valid receipt and `action.requiresHuman`.
> 4. `store.ts` — in-memory `Map` of pending actions + issued receipts + executed `nullifierHash`es (replay protection). File-persist to `.data/` so a server restart mid-demo doesn't lose the session.
> 5. System prompt: the agent must **cite the subgraph and the concrete numbers** behind every risk claim, and must never assert it has done something it only proposed.
> 6. Routes: `POST /api/agent/plan` and `POST /api/agent/execute`.
>
> **Load the `claude-api` skill before writing the Anthropic integration** — do not write the tool-use loop from memory.

**Acceptance:** A full scripted conversation ("check 0x…", "now run the recipe") produces: live Graph data → risk score → gated action → receipt → recipe run. `execute()` without a receipt throws.

---

### 🟫 T6 — UI / chat `[~5h · start in parallel with mocks]`
**Owns:** `src/app/page.tsx`, `src/app/dashboard/**`, `src/components/**` *(except `HumanGate.tsx`, owned by T3)*

**Prompt:**
> Build the interface. Dark, dense, technical — an operator console, not a landing page. Tailwind only, no component library.
> 1. `src/app/page.tsx` — landing: one-sentence pitch, the 6-step flow diagram from PLAN.md §1 as clean inline SVG, "Open Console" CTA.
> 2. `src/app/dashboard/page.tsx` — three-pane console:
>    - **left:** chat thread (`ChatMessage[]`), streaming assistant replies
>    - **centre:** the **Evidence panel** — live `WalletActivity` rendered as compact stat tiles + the risk score as a gauge, each reason listed with its citation, and a visible `subgraphId` + `queriedAt` timestamp badge reading **"LIVE — queried 3s ago"**. This badge is how a judge sees the data isn't mocked; make it prominent.
>    - **right:** **Receipt trail** — append-only audit log of actions, who approved them (truncated `nullifierHash`), when, cost, outcome.
> 3. Pending-action card: summary, cost, risk score, truncated action hash, and a big **"Approve with Selfie Check"** button mounting `<HumanGate action={action} />`. While no valid receipt exists, the Execute button is **visibly disabled with the reason spelled out** ("Blocked: awaiting human approval").
> 4. Show the rejection path: if execution is attempted without a receipt, render a red audit entry. Do not hide it.
> 5. Responsive down to 400px; panes stack on narrow screens.
> 6. **Load the `dataviz` skill before building the stat tiles and risk gauge.**
>
> Until T2/T5 merge, develop against `MOCK_*=1` fixtures behind a clearly visible amber "MOCK DATA" badge, so nobody demos the mock by accident.

**Acceptance:** Full flow clickable end to end. Live badge shows a real timestamp. Disabled-execute state is self-explanatory without narration.

---

### ⬜ T7 — Documentation `[~2h · after T2/T3/T4 land]` 🏆 *hard prize requirement*
**Owns:** `README.md`, `FEEDBACK.md`, `SKILL.md`

**Prompt:**
> 1. `README.md` — what it is, the problem (agents that verify a human once then spend freely), the action-bound-proof solution, architecture diagram, **exact setup steps from clone to running demo**, env var table, sponsor-track checklist with links to the code proving each claim, and the demo video link.
> 2. **`FEEDBACK.md` — mandatory for the World prize and directly scored.** Build it from `notes/worldid-friction.md`. **Use the track's own four headings verbatim, in this order**, so a judge can tick them off:
>    - **`## SelfieCheck docs and integration flow`** — doc gaps, wrong/missing code samples, `selfieCheckLegacy` preset discoverability, the World ID 3.0-vs-4.0 proof confusion, RP signature setup.
>    - **`## Developer Portal: navigation, search, product discovery, debugging guidance`** — how hard was it to find Selfie Check at all; was credential `11` discoverable without already knowing its name; what did errors tell you (or not).
>    - **`## Sandbox App: states, proof flows, test users, errors, edge cases`** — report **Hot / Cold / Semi-cold separately**, each with what you did, what you saw, and the literal error text. Cover invite-code handling, test-user reset, and the iOS semi-cold gap if you hit it.
>    - **`## What was confusing, missing, broken, or hard to test`** — the summary section.
>
>    **Lead with the two access gates** — the feature flag behind `developers@toolsforhumanity.com`, and the Sandbox app being unavailable in public stores (TestFlight / private Play link). Neither is self-serve, and both cost a hackathon team hours it doesn't have.
>
>    Every item must be **specific and reproducible**: what you tried → what you expected → what happened → the exact error string. No generic praise, no "docs were mostly good". Vague feedback scores nothing; a judge should be able to file each bullet as a ticket. Include a short "what worked well" section too — credible criticism needs a baseline.
> 3. `SKILL.md` — for The Graph track: which subgraphs we query, which MCP tools we call, how the data is load-bearing for the risk decision, and how another agent could reuse our skill.

**Acceptance:** A stranger can clone and run it from `README.md` alone. `FEEDBACK.md` contains ≥ 8 specific, actionable observations.

---

### ⬜ T8 — Demo video `[~3h · last]` 🏆 *hard prize requirement*
**Owns:** `DEMO.md`

**Constraints (disqualifying if broken):** 2–4 min · ≥ 720p · clear human voice · **no AI voiceover** · no music-instead-of-voice · not filmed on a phone.
*We ship desktop web, so: screen-record the desktop app as the main track, and capture the Sandbox phone separately (screen mirroring, or a second camera on the handset) and cut it in. "Not filmed on a phone" bans phone-shot footage of your screen — it does not ban showing a phone in frame.*

**Prompt:**
> Write `DEMO.md`: a shot-by-shot script with timestamps and the exact spoken narration.
> Suggested beats: `0:00` problem — agents that verify once and then spend freely · `0:25` ask the copilot about a real address · `0:45` **Evidence panel, point at the LIVE badge and the subgraph id** · `1:10` agent proposes a paid action, Execute is blocked · `1:25` **agent tries to pay without approval → rejected on camera** · `1:45` **Selfie Check: QR on desktop → Android Sandbox app → liveness/face flow → proof returns**; say aloud that the signal is bound to this exact action · `2:20` recipe runs across both services, x402 settles · `2:40` receipt trail — point at **"returning human, first approved N days ago"** (the continuity signal) · `3:00` tamper demo: change the payload, receipt no longer validates · `3:20` close on the three sponsor integrations.
>
> Narration must state the three signals we claim — **abuse prevention, risk, continuity** — in those words, since they're the track's own vocabulary. Say "medium-assurance, raises the cost of automated abuse"; **never** "sybil-proof" or "one person one account".
>
> **Bazantic requires the screen recording to show the completed task start to finish**, so the `2:20` beat must show the recipe running as one continuous unbroken take — no cuts mid-run — with step A's Graph output visibly becoming step B's input. If the main video can't hold an uncut run, record a **separate supplementary screen recording** for the Bazantic submission rather than cutting the main one badly.
>
> Also produce a 280-char submission blurb and the per-track submission form answers — **including the Bazantic account username**, which is a hard qualification requirement.

---

## 6. Schedule (~46h, realistic)

| When | What |
|---|---|
| **Fri 11th, now** | **T0.1 email → send it before anything else.** Then T0.2–0.7 credentials. |
| Fri, +1h | **T1 solo.** Nothing else starts until types.ts exists. |
| Fri evening | Launch **T2, T3, T4, T6** in parallel (4 agents). |
| Fri night | Merge T2/T3/T4 branches. Fix interface drift. |
| **Sat morning** | **T5** orchestrator. First real end-to-end run. |
| **Sat midday** | **🔶 Agentify-stretch go/no-go decision** (§0). Green primary recipe, or it's a NO. |
| Sat afternoon | T6 wired to live data. Kill all mock paths. Hunt bugs on the real flow. |
| Sat evening | **T7 docs.** Freeze features. |
| Sat night | Rehearse the demo twice on the real app. Fix only what breaks on camera. |
| **Sun morning** | **Record + edit video (T8). Submit by 12:00 Kyiv** — 4h before the 16:00 deadline. |

**Feature freeze: Saturday 22:00 Kyiv.** After that, only bug fixes, docs and video.

---

## 7. Risk register

| Risk | P | Impact | Mitigation |
|---|---|---|---|
| **Selfie Check feature flag not granted in time** | High | High | Email first thing (T0.1). Ship `allow_legacy_proofs` fallback — the track accepts a "Selfie Check-**compatible** credential flow". Turn the gap into lead `FEEDBACK.md` material; it's scored either way. |
| **Sandbox app access (TestFlight / Play link) not granted** | High | High | Request it in the *same* email as the feature flag. Without it there is **no working demo** — "shows a working app" is a qualification requirement. Escalate in the ETHGlobal Discord World channel if no reply within ~6h. |
| **Only an iPhone available as the test phone** | Med | **Low** | Affects the *test device*, not the product (which is desktop web). Hot and Cold work fine on iOS; only semi-cold has documented invite-code gaps. Run Hot + Cold, document the iOS gap in `FEEDBACK.md` — the docs already acknowledge it, so "could not test, known limitation" is legitimate feedback. **Not worth borrowing or buying a phone over.** |
| Overclaiming assurance in README/video | Med | Med | Selfie Check is **medium-assurance, not one-person-one-account**. Say "raises the cost of automated abuse". World judges will catch "sybil-proof". |
| Subgraph MCP SSE transport fights Next.js | Med | Med | Hard 45-min timebox, fall back to Gateway GraphQL. The prize requires *live Graph data*, not specifically MCP. |
| Bazantic gateway build is slow/unfamiliar | Med | High | Start T0.6 early with a minimal OpenAPI spec; don't wait for the final one. |
| x402 settlement needs funded wallet | Med | High | Check funding requirements **Friday** (T0.6c), not Sunday. |
| Recipe reads as two stapled calls, not a chained flow | Med | High | The scored phrase is *"the final result depends meaningfully on both"*. Enforce the A→B→C data seam in T4 and **show the values crossing it on screen**. |
| Forgetting the Bazantic username in the submission form | Low | **Fatal to the track** | Record it in `README.md` at T0.5 and put it on the §8 checklist. |
| Chasing the 🔶 Agentify stretch and destabilising the primary | Med | High | Gate the decision at **Saturday midday**, only if the primary recipe is already green. Default NO. |
| Agents collide on shared files | Med | Med | Exclusive file ownership + one branch per task (§5). |
| Last-minute mono-commit penalty | Low | Med | ≥ 4 commits per task, enforced in each prompt. |
| Demo breaks live on camera | Med | High | Rehearse twice Saturday night; script only paths already proven to work. |

---

## 8. Definition of done

- [ ] Public GitHub repo, clean incremental commit history, no mono-commit
- [ ] Live Graph data in the shipped path — **zero mocks**, provenance visible in the UI
- [ ] Selfie Check (or documented compatible fallback) gating every paid action, tested in Sandbox
- [ ] **All three Sandbox states exercised — Hot / Cold / Semi-cold** — results written down per state
- [ ] World ID `signal` bound to `keccak256(canonical(action.payload))`, tamper-proof — with a test
- [ ] **Continuity implemented**: receipt trail distinguishes returning vs. new human by `nullifierHash`
- [ ] README + video claim exactly **abuse prevention / risk / continuity**, with no assurance overclaim
- [ ] `FEEDBACK.md` uses the track's **four verbatim headings**, leads with the two access gates
- [ ] Bazantic **x402/MPP Gateway** live for our project, x402 settling
- [ ] Recipe chains our gateway **+ ≥1 sponsor/catalog service**, with step A's output visibly feeding step B
- [ ] Recipe carries a **when / why / how** description an agent can act on unaided
- [ ] **Bazantic username recorded in `README.md` and entered in the submission form**
- [ ] Execution without a valid receipt is rejected server-side and demoed
- [ ] `README.md`, `FEEDBACK.md`, `SKILL.md`, `bazantic-recipes.json` all present
- [ ] Demo video 2–4 min, ≥ 720p, real human voice, no phone footage
- [ ] Bazantic username entered in the submission form
- [ ] Submitted by **Sun 12:00 Kyiv**
