# T6b — Wire the console to the live APIs · copy-paste agent prompt

Worktree: `/workspaces/matching-t6b` · branch `feat/t6b-wire` (already created from integrated main)

---

You are finishing the UI of a hackathon project (ETHOnline 2026, deadline Sunday 13 Sep 09:00 EDT).

**Your working directory is `/workspaces/matching-t6b`.** Run `npm install` first (fresh directory).
**Read `PLAN.md` §1 and §3 before starting.**

## The situation

"Human-Gated AI Copilot": a chat agent reads live on-chain data via The Graph, scores wallet risk,
and proposes actions. Risky or paid actions are blocked until a human approves with a World ID Selfie
Check bound to the exact payload.

**The console and the backend were built in parallel and never connected.** The dashboard
(`src/app/dashboard/page.tsx`) still renders **hardcoded fixtures** from `src/components/_mocks.ts`:
the chat is a static list, there is no input box, the pending action is a fixture, and the
"approval" swaps in a fixture receipt. Meanwhile the real routes now exist on `main` and work.
**Your job is to connect them**, so the full flow runs end to end against real routes.

## Files you OWN
- `src/app/dashboard/**`
- `src/components/**` — **except `src/components/HumanGate.tsx`**

## Files you MUST NOT edit
- `src/components/HumanGate.tsx` — the World ID gate. **Use it; don't change it.**
- `src/lib/**` — including `types.ts` (FROZEN), `agent/`, `worldid/`, `env.ts`
- `src/app/api/**` — all routes. Consume them; don't change them. If a route's contract blocks you,
  STOP and report it.
- `src/app/page.tsx`, `PLAN.md`, `requirements.md`

## Git discipline (graded)
- **Do NOT run `git checkout`, `git switch`, or `git branch`.** Sibling worktrees share this repo.
- **≥ 4 small commits with real messages.** No mono-commit. Do not merge to `main`.

---

## ✅ The real route contracts (read from the code on main; trust these)

All errors share one shape: `{ error: { code: string, message: string } }`.

**`POST /api/agent/plan`**
- Body: `{ messages: ChatMessage[] }` (at least one message)
- 200 → `{ reply: string, action?: AgentAction }`
- 400 `INVALID_REQUEST` · 502 `PLAN_FAILED`

**`POST /api/agent/execute`**
- Body: `{ actionId: string }`. **Send only the id.** The server looks up the action *and* the
  receipt itself; it never trusts a client-supplied receipt. That's a security property, so keep it.
- 200 → `RecipeRun`
- 400 `INVALID_REQUEST` · 404 `ACTION_NOT_FOUND` · **403 `HUMAN_GATE_REJECTED`** (message starts
  `"Blocked:"`) · 502 `EXECUTION_FAILED`

**`GET /api/graph/activity?address=0x…`** → `RiskAssessment`
- ⚠️ **Being built in parallel by another agent; not on main yet.** Keep the existing fallback in
  `_api.ts`, which shows the amber MOCK DATA banner, until it lands.

**`<HumanGate action={action} />`** (`src/components/HumanGate.tsx`)
- Handles the whole World ID flow internally (fetches `/api/worldid/rp-context`, calls
  `/api/worldid/verify`).
- On success it dispatches `window` event **`human-gate:approved`** with
  **`detail: { actionId: string, receipt: HumanGateReceipt }`**.
- ⚠️ The current dashboard listener **ignores `detail`** and swaps in `approvedReceipt` from the
  fixtures. **Fix this: use the real `detail.receipt`**, and check `detail.actionId` matches the
  pending action.

---

## What to build

### 1. Live chat
- Add a message input. On submit, append the user message and POST the **whole** thread to
  `/api/agent/plan`. Render `reply` as the assistant turn.
- If the response includes `action`, that becomes the pending action card. Replace the
  `pendingAction` fixture with real state.
- Show a visible thinking state while waiting; the agent can take several seconds.
- Render `PLAN_FAILED` visibly in the thread. **⚠️ No LLM API key is configured yet**, so today every
  plan call returns 502 with a message naming the missing key. That's expected. The UI must show it
  clearly, not hang or crash.

### 2. Real approval → real receipt
- Mount `<HumanGate action={pendingAction} />` for the *real* pending action.
- On `human-gate:approved`, if `detail.actionId === pendingAction.id`, store `detail.receipt` and
  append it to the receipt trail.

### 3. Real execution
- **Execute** calls `POST /api/agent/execute { actionId }`.
- 200 → append a success entry with the `RecipeRun` (status, steps, `costUsd`).
- 403 → append a **red rejection entry showing the server's message verbatim**.

### 4. ⭐ The "agent tries to pay without a human" beat — the most important demo moment
The demo video has a scripted beat where the agent attempts to spend **before** approval and gets
refused on camera (PLAN.md T8, `1:25`). Right now Execute is disabled until a receipt exists, so
that beat is **impossible to film**.

Add a clearly labelled secondary control, e.g. **"Attempt execution without approval"**, visible only
while an action is pending without a receipt. It calls the *real* execute route. The server answers
403 `HUMAN_GATE_REJECTED`, and the red entry lands in the trail. **Do not fake this client-side.** The
point is that the *server* refuses. Keep the primary Execute button disabled with its reason, as now.

### 5. Fix the receipt-trail bugs
- `ReceiptEntry` renders `pendingAction.costUsd` for **every** entry, which is wrong once there are
  real, differing actions. Take cost from the entry's own data.
- Make the trail genuinely **append-only session state**: approvals, executions and rejections in
  order, newest first. The static fixture entries must not render in live mode.
- Keep the continuity line: "returning human · first approved N days ago" vs "new human", from
  `receipt.continuity`.

### 6. Deep link `?action=<id>` — build it, but keep it best-effort
Another agent (T4) is adding `GET /api/gateway/action?id=<actionId>`, which returns an `AgentAction`
so a human can open an approval link from an external agent's recipe. Support
`/dashboard?action=<id>`: fetch it and load it as the pending action. **That route doesn't exist
yet**, so handle a 404 gracefully (a small "action link not found" notice) and don't block on it.

### 7. Keep fixtures only as an explicit fallback
Fixtures may remain **only** behind the existing mock path, and only while showing the amber MOCK DATA
banner. **Nothing fixture-derived may render without that banner.** The Graph prize disqualifies
mocked data outright.

## Constraints
- **Next.js 16.3.4 / React 19.2.8 / Tailwind 4.** Next 16 has breaking changes vs. your training data
  (`AGENTS.md`). Read `node_modules/next/dist/docs/` before touching routing or data fetching.
- **Gotcha:** in a fresh worktree run `npm run build` **before** `npx tsc --noEmit`. Otherwise tsc
  reports `Cannot find name 'LayoutProps'`, which is not a real error.
- Tailwind only, existing theme tokens only, no new hex colours, no component library.
- **The dashboard is one ~140-line file with very long single-line JSX.** Split it into readable
  components under `src/components/` as you go. The next person has to be able to read it.
- Desktop-first, but must still work at 400px.
- TypeScript strict. `npm run build` + `npx tsc --noEmit` clean before each commit.

## How to verify without credentials
Run `npm run dev` and exercise it:
- Sending a chat message shows the 502 `PLAN_FAILED` message clearly (no LLM key yet).
- `curl -X POST localhost:3000/api/agent/execute -H 'content-type: application/json' -d '{"actionId":"nope"}'`
  returns 404 `ACTION_NOT_FOUND`. Confirm the UI renders that shape correctly.
You can't complete a real Selfie Check without World ID credentials. Build the event handling to
the documented `detail` shape.

## Definition of done
- [ ] Chat input posts the full thread to `/api/agent/plan` and renders reply + action
- [ ] `PLAN_FAILED` is shown clearly, with no hang or crash
- [ ] Pending action card driven by real state, not the fixture
- [ ] Approval uses the real `detail.receipt`, checked against the pending action id
- [ ] Execute calls the real route; 200 and 403 both land in the trail
- [ ] **"Attempt execution without approval" hits the real route and shows the server's 403**
- [ ] Receipt trail is append-only session state with per-entry cost
- [ ] `?action=<id>` deep link supported, 404 handled gracefully
- [ ] No fixture renders without the MOCK DATA banner
- [ ] Dashboard split into readable components
- [ ] `npm run build` clean, `npx tsc --noEmit` clean
- [ ] ≥ 4 commits, no files outside ownership touched

Report at the end: what's wired, what you could not verify without credentials, and any route
contract that blocked you.
