# Human-Gated AI Copilot

**An AI agent that reads live on-chain evidence, proposes actions — and cannot spend a cent until a
real human approves that exact action with a World ID Selfie Check.**

🌐 **Live:** https://matching-nu-ten.vercel.app/
🎥 **Demo video:** _[(link added at submission)_](https://www.youtube.com/watch?v=r11XTLX1cmQ)

---

## The problem

Agentic apps verify a human **once, at login**, then let the agent act freely for the rest of the
session. Everything after that login is unattested: a prompt-injected or simply confused agent
spends with the human's authority long after the human stopped watching.

## The idea: bind the proof to the action, not the session

The World ID **`signal`** is set to **`keccak256(canonicalJson(action.payload))`**. The proof is not a
login — it is a **per-action approval receipt**. Change one byte of what the agent proposed and the
receipt stops validating, server-side.

```
 you ──▶ agent ──1──▶ The Graph (live subgraph)  ──▶ wallet evidence
                └──2──▶ risk engine (deterministic) ──▶ score + cited reasons
                └──3──▶ propose action, hash the exact payload
                         │
      risk ≥ 50 or cost > 0 ──▶ 4. Selfie Check, signal = keccak256(payload)
                         │        (QR on desktop → World App → liveness + face)
                         ▼
                 5. server verifies the proof, re-deriving the hash itself
                         │            ──▶ HumanGateReceipt (single-action, 5 min)
                         ▼
                 6. x402 payment runs only against a valid, matching receipt
```

## New: agent marketplace (From Dusk Till Dawn #01)

Buyer agents discover provider agents, lock payment in escrow, and an AI judge
checks the delivery before money moves. Small deals run agent-to-agent; large
deals and uncertain verdicts wait for the same Selfie Check gate. Payments are
real USDC transfers on Ethereum Sepolia (testnet) through a custodial escrow
wallet (not a smart contract); the agents run on Gemini on our own server.

One small deal, end to end on Ethereum Sepolia (testnet USDC, 9 Oct 2026):
[lock, buyer → escrow](https://sepolia.etherscan.io/tx/0x92fc70b2c6ccac4daa0033c69ac0f395c0f372f91c39e21593fa399e398260a4) ·
[payout, escrow → provider](https://sepolia.etherscan.io/tx/0xcdebdd2403ad5bd70948d96b11ef1469762405ad655841fcdda739c6f8507caf).
The provider's payout address is our own escrow wallet (we have no second
party's wallet), so this payout moves USDC back to the same wallet.

Three ideas come from [SingIt](https://github.com/bubon-ik/SingItAI) by bubon-ik
(MIT), re-implemented here with no code copied: a per-job spending limit, one
payout address per provider, and paying only after delivery.

```bash
npm run dev
npm run market:demo        # story A ($0.02, no human) and story B (large deal, Selfie Check)
```


### The three signals we claim (World track vocabulary)
- **Abuse prevention** — an autonomous agent cannot spend without a fresh human proof bound to that exact payload.
- **Risk** — the gate is *risk-triggered, not blanket*: `requiresHuman = riskScore >= 50 || costUsd > 0`, from live Graph data. Low-risk reads stay frictionless, which is the argument for a low-friction, medium-assurance credential.
- **Continuity** — Selfie Check's 90-day validity confirms a returning user is the same person; the receipt trail shows "returning human · first approved N days ago".

**Assurance, stated honestly:** Selfie Check is **medium-assurance** and explicitly **not**
one-person-one-account. We claim it *raises the cost of automated and repeated abuse*. It is not
sybil-proof, and we never say it is.

## What is genuinely live


## Security properties (each with a test)

| Property | Where | Test |
|---|---|---|
| Proof bound to the exact payload | `src/lib/worldid/hash.ts` | one byte changed ⇒ receipt invalid |
| Canonicalisation is unambiguous | same | key order/whitespace can't change the hash; `NaN`, `-0`, `undefined`, BigInt, Dates rejected |
| Receipts are single-use | `src/lib/worldid/receipt.ts` | 8 concurrent validations, exactly 1 wins |
| The gate cannot fail open | `src/lib/agent/execute.ts` | invalid receipt is refused *before* any payment step |
| Only our relying party | `src/app/api/worldid/verify/route.ts` | a foreign `rp_id` is rejected |
| The agent cannot self-approve | `src/lib/agent/tools.ts` | `propose_action` has no path to execution |
| Risk isn't the model's opinion | `src/lib/agent/tools.ts` | score recomputed server-side from Graph data |
| No unbacked claims | `src/lib/agent/plan.ts` | a "prepared" claim without an action is corrected server-side |



Minimum to see live Graph data and the agent: `GRAPH_API_KEY` (Subgraph Studio) and
`GEMINI_API_KEY`. Add `NEXT_PUBLIC_WLD_APP_ID`, `NEXT_PUBLIC_WLD_ACTION`, `WLD_RP_ID` and
`WLD_RP_PRIVATE_KEY` for approvals; `BAZANTIC_GATEWAY_URL`, `BAZANTIC_RECIPE_ENDPOINT` and
`X402_PRIVATE_KEY` for paid execution. Storage uses local files in dev and Redis when
`*_REST_API_URL`/`_TOKEN` are present (required on Vercel, whose filesystem is read-only).


An external agent can **prepare** an action. It can never **approve** one.

## Repository map

| Path | What |
|---|---|
| `src/lib/graph/` | Gateway GraphQL, Subgraph MCP, deterministic risk engine |
| `src/lib/worldid/` | canonical hashing, receipt validation, continuity ledger |
| `src/lib/bazantic/` | x402 payment client, recipes, run log |
| `src/lib/agent/` | tool loop (Gemini), plan/execute, shared store |
| `src/app/api/` | 7 routes: agent, worldid, graph, gateway |
| `src/app/[lang]/dashboard/` | three-pane operator console |
| `src/i18n/` | English / Czech / Ukrainian dictionaries, locale negotiation in `src/proxy.ts` |
