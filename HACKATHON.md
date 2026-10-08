# From Dusk Till Dawn #01 — what is base and what is new

Track: **Agentic Economy** — agent discovery, payments, wallets and dispute resolution.

This file separates the existing foundation from the work done for this
hackathon, and what is real from what is not, so the jury can judge the new
work on its own.

Live: [matching-nu-ten.vercel.app/en/market](https://matching-nu-ten.vercel.app/en/market)

## The base (existed before this hackathon)

- **Human-Gated AI Copilot** — this repository, built for ETHOnline 2026 in
  September 2026: the agent (`src/lib/agent`), live wallet risk from The Graph
  (`src/lib/graph`), World ID Selfie Check bound to the exact action payload
  (`src/lib/worldid`), the x402 gateway (`src/lib/bazantic`) and the dashboard.
  See [README.md](README.md) and [PLAN.md](PLAN.md).
- **SingIt** by [bubon-ik](https://github.com/bubon-ik) —
  [github.com/bubon-ik/SingItAI](https://github.com/bubon-ik/SingItAI), MIT
  licence, © 2026 SingIt. An agent that pays sellers over x402 inside spending
  limits. We reused three of its **ideas**, re-implemented in TypeScript here;
  no SingIt source code was copied:
  1. a per-job spending limit, below which the agent may pay alone;
  2. each provider is bound to the one address it is paid at;
  3. "paid" and "delivered" are separate facts — money is released only after
     the work is delivered.

## New for this hackathon: the agent marketplace

Started on 7 October 2026, the evening before the event, and continued during
it. The `main` history is short (a few large commits), so this table is the
record of what was added.

| Part | Where | What it does |
|---|---|---|
| Discovery | `src/lib/market/discovery.ts`, `catalog.ts` | A buyer agent names a skill; a provider is chosen by price ceiling, rating and strategy. Deterministic — the model never chooses who gets paid. |
| Escrow | `src/lib/market/escrow.ts`, `deals.ts` | Deal state machine. Funds lock before work starts, release only after delivery, and pay out at most once (atomic claim). |
| On-chain settlement | `src/lib/market/settlement.ts` | Real USDC transfers on **Ethereum Sepolia** (testnet): lock = buyer wallet → escrow wallet, release = escrow → provider, refund = escrow → buyer. Each transfer is simulated against the chain before it is sent; a transfer that fails after broadcast is never retried automatically. |
| Hard spending caps | `src/lib/market/spend.ts` | Enforced in code, not in a prompt: $5 per payment, $10 per day by default. |
| Judge | `src/lib/market/judge.ts` | One model call compares the order with the delivery: accepted / rejected / uncertain. Fixed rules turn the verdict into release, refund or escalation. The model never moves money itself. |
| Provider check on The Graph | `src/lib/market/provider-risk.ts` | Before money is locked, the provider's payout wallet is read from the live Uniswap V3 subgraph and scored by the base risk engine. |
| Human gate | `src/lib/market/deals.ts`, `policy.ts` | Deals above $1, and any verdict that is uncertain or below 0.7 confidence, wait for the existing Selfie Check, bound to the exact deal payload. |
| Buyer agent | `src/lib/market/buyer.ts`, `api/market/ask` | Reads a request in plain words (EN/UK/CS) and turns it into an order. The model only fills in the order; the skill must exist in the catalog. Keyword fallback without a model. |
| Provider agents | `src/lib/market/worker.ts`, `api/market/deals/work` | Each demo provider does its job through a model call with a skill brief; the deal records who produced the output. |
| Model client | `src/lib/market/openai.ts` | One Chat Completions client for buyer, providers and judge. Uses **Google Gemini** (`gemini-flash-lite-latest`) through Gemini's OpenAI-compatible endpoint; uses OpenAI instead only if `OPENAI_API_KEY` is set. |
| Apify Scout | `src/lib/market/apify.ts`, `worker.ts` | The `web_research` provider runs an Apify Actor and cites the pages it returned. |
| Spoken alerts | `src/lib/market/voice.ts`, `api/market/voice` | The console says key moments out loud in EN/UK/CS. |
| Deal console | `src/app/[lang]/market/`, `src/components/MarketConsole.tsx` | One screen for the whole deal: plain-language request, discovery, Graph evidence, Selfie Check, provider agent, judge, transactions, history. |
| Tests | `src/lib/market/*.test.ts` | 73 tests (`node --test "src/lib/market/*.test.ts"`). |

## Real transactions (Ethereum Sepolia, testnet USDC)

| What | Transaction |
|---|---|
| Lock: buyer → escrow, 0.02 USDC, small translation deal (8 Oct 2026, 23:38 CEST) | [0xbd0c56e9…f7e96f](https://sepolia.etherscan.io/tx/0xbd0c56e98c79c02cf8d596d2e924deb7b46a7b7d404542edbff329686ef7e96f) |

That deal's provider step then failed, because the deployed site had no
OpenAI key and the client did not yet fall back to Gemini. That was fixed in
commit `d323500`. The 0.02 USDC stayed in the escrow wallet; nothing was paid
out for it.

Wallets: buyer [0x1c6B…1b5A](https://sepolia.etherscan.io/address/0x1c6B9Be2E711C175F49C51b9b350722F53B71b5A),
escrow [0x902B…7661](https://sepolia.etherscan.io/address/0x902Bf6E3D3412b3537417189c4afc591c74c7661).
USDC contract: Circle's Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`.

## What is real and what is not

| Real | Not real, or limited |
|---|---|
| USDC transfers on Ethereum Sepolia, visible on Etherscan (links above) | It is a **testnet**: the USDC has no real value. |
| Escrow holds the money between lock and payout | The escrow is **custodial**: a wallet whose key our server holds, not a smart contract. |
| Discovery, escrow state machine, payout rules and spending caps — running code with tests | The **provider payout addresses are ours**. Lingo Fast and Audit Hawk are paid to the escrow wallet itself (we have no second party's wallet), so a "payout" to them moves USDC from the escrow wallet back to the same wallet. The other providers have placeholder addresses nobody controls. |
| Buyer agent, provider agents and judge are real Gemini calls | **Provider agents** are model calls on this same server with a skill brief — not independent services run by other people. The catalog is a fixed list, not a live registry. |
| Provider wallet evidence is live Graph data | On the deployed site `MARKET_GRAPH_GATE=advisory`: the Graph evidence is shown but does **not** stop a deal (a wallet without Uniswap history is flagged, so our own test wallets would send every deal to a human). |
| The Selfie Check is the real World ID flow from the base project | Without a reachable model the judge does not guess: the verdict is "uncertain" and goes to a human. |
| | Apify Scout works only when `APIFY_TOKEN` is set; it was not part of the demo. |
| | Spoken alerts use the browser's built-in voice; ElevenLabs is not configured. |

## Known limits

- No escrow smart contract yet: the next step is locking USDC in a contract
  (or Masumi's escrow) instead of an agent-held wallet.
- The daily spending cap is a read-then-write on the key-value store, so two
  payments in the same instant could both pass it; each single payment is
  still capped.
- A human approval receipt lives 5 minutes, so funding or resolving must
  follow the Selfie Check within that window.
