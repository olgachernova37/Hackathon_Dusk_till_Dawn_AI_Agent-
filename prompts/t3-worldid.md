# T3 — World ID / Selfie Check gate · copy-paste agent prompt

Worktree: `/workspaces/matching-t3` · branch `feat/t3-worldid` (already created)

---

You are building the human-verification layer for a hackathon project (ETHOnline 2026, deadline
Sunday 13 Sep 09:00 EDT).

**Your working directory is `/workspaces/matching-t3`.** Start there. **Read `PLAN.md` first** — it is
the spec, especially §0 (Selfie Check facts) and §5 T3.

## The project in one paragraph

"Human-Gated AI Copilot" — a chat agent reads live on-chain data via The Graph, scores wallet risk,
and proposes actions. Any risky or paid action is blocked until a real human approves it with a World
ID **Selfie Check**, where the proof is cryptographically bound to that exact action payload.
Execution then runs through a Bazantic x402 gateway that refuses to spend without a valid receipt.

**You are building the gate. It is the heart of the project** — if your hashing is subtly wrong, the
entire "tamper-proof" claim collapses and we lose the World track.

## Files you OWN
- `src/lib/worldid/**`
- `src/app/api/worldid/**`
- `src/components/HumanGate.tsx` — currently a stub left by another agent; you replace it
- `notes/worldid-friction.md` — append-only log, see below

## Files you MUST NOT edit
- `src/lib/types.ts` — **FROZEN shared contract.** Read it, code against it, never change it. It
  already defines `HumanGateReceipt`, `ContinuityInfo`, `RpContext`, `RECEIPT_TTL_MS`,
  `CREDENTIAL_VALIDITY_DAYS`. If you need a change, STOP and report it instead of editing.
- `src/app/page.tsx`, `src/app/dashboard/**`, `src/components/**` except `HumanGate.tsx`
- `src/lib/graph/**`, `src/lib/bazantic/**`, `src/lib/agent/**`, `src/app/api/graph/**`, `src/app/api/bazantic/**`
- `PLAN.md`, `requirements.md`

You MAY add dependencies to `package.json` (you will need `@worldcoin/idkit`). Expect a possible
lockfile conflict at merge — that is fine and expected, do not try to avoid it.

## Git discipline (this is graded)
- **You are already on your branch in your own worktree. Do NOT run `git checkout`, `git switch`, or
  `git branch`.** Other agents work in sibling worktrees of this repo; switching branches breaks them.
- **Make at least 4 small commits with real messages.** ETHGlobal explicitly penalises a single
  last-minute mono-commit. Do not squash.
- Do not merge to `main` yourself.

---

## Part A — the cryptographic core (no credentials needed, do this FIRST)

This part is pure logic and fully testable right now. **Get it right before touching any SDK.**

### `src/lib/worldid/hash.ts`
- `canonicalJson(value): string` — deterministic serialisation. Recursively sort object keys; preserve
  array order (arrays are ordered data); no whitespace. **Throw loudly** on values that would make the
  hash ambiguous: `undefined`, `NaN`, `Infinity`, `-0`, functions, symbols, `BigInt`. A silent
  coercion here is a security hole.
- `hashAction(payload): string` — `keccak256` of the canonical string, via `viem` (already installed):
  `keccak256(toHex(canonicalJson(payload)))`. Returns `0x…`.
- Do **not** normalise semantics (do not lowercase addresses, do not round numbers). Canonicalisation
  is purely structural — strict binding is the point.

### `src/lib/worldid/continuity.ts`
Selfie Check confirms a returning user is the same person for 90 days. That is our **continuity**
signal for the prize.
- File-backed ledger at `.data/humans.json` (gitignored already): `{ [nullifierHash]: { firstSeenAt, approvalCount } }`
- `recordApproval(nullifierHash): ContinuityInfo` and `getContinuity(nullifierHash): ContinuityInfo`
- `daysKnown` is measured against `CREDENTIAL_VALIDITY_DAYS` from `types.ts`.
- Server-only. Create `.data/` on demand; handle a missing or corrupt file without crashing.

### `src/lib/worldid/receipt.ts`
- `assertValidReceipt(receipt, action): void` — **throws** on any of: expired (`expiresAt` past),
  `actionId` mismatch, `actionHash` mismatch (recompute it, never compare a stored string alone), or
  the action already executed (replay). Keep an executed-action ledger in `.data/`.
- Distinct, specific error messages per failure — they surface in the UI and in the demo video.

### Tests (required)
Use the built-in `node:test` + `node:assert/strict`. Node 24 strips TypeScript types natively — check
`node --test src/lib/worldid/hash.test.ts` runs; if it does not, add `tsx` as a devDependency.

Cover at minimum:
- key order and whitespace never change the hash
- nested objects and arrays
- array order **does** change the hash
- every throwing case above
- tampering with one byte of `action.payload` makes `assertValidReceipt` throw
- a second approval by the same nullifier reports `isReturning: true`

---

## Part B — the World ID integration

**⚠️ No credentials exist yet** — `.env.local` is not created and Selfie Check access is still
pending. Build against the documented API, keep it working the moment keys land, and do not block on
them. `src/lib/env.ts` already exposes `clientEnv` and `serverEnv()`.

### The two World ID fields — get this backwards and both prize claims die
| Field | Value | Job |
|---|---|---|
| `action` | constant, from `NEXT_PUBLIC_WLD_ACTION` | Scopes the nullifier, so the same person always yields the same `nullifierHash` → **continuity** |
| `signal` | `hashAction(action.payload)`, different every time | Binds the proof to the exact payload → **tamper-proof** |

### `src/app/api/worldid/rp-context/route.ts`
Build and sign the `RpContext` (`rp_id`, `nonce`, `created_at`, `expires_at`, `signature`) server-side
using `WLD_RP_PRIVATE_KEY`. **Never expose that key to the client.**

### `src/components/HumanGate.tsx`
Replace the stub. **Preserve its public contract** so the existing dashboard keeps working:
- default export, single prop `{ action: AgentAction }`, `"use client"`
- on success it dispatches `window.dispatchEvent(new CustomEvent("human-gate:approved", { detail }))`
- **Extend `detail` to `{ actionId, receipt }`** (the stub sent only `action.id`). Note this in your
  final report — the dashboard owner may need a one-line change.

Render `IDKitInviteCodeRequestWidget` from `@worldcoin/idkit` with:
`app_id`, `action`, `rp_context`, `allow_legacy_proofs: true`,
`preset={selfieCheckLegacy({ signal: hashAction(action.payload) })}`,
`environment={clientEnv.NEXT_PUBLIC_WLD_ENV}` (`"sandbox"`).

**Before the widget opens, show exactly what is being approved** — summary, cost, risk score, and the
truncated action hash. This dialog is the money shot of the demo video. Style with the existing
Tailwind tokens (`bg-panel`, `border-border`, `text-muted`, `text-ok`/`warn`/`danger`/`brand`); no new
hex colours, no component library.

### `src/app/api/worldid/verify/route.ts`
POST `{ rp_id, idkitResponse, actionId }`:
1. Look up the pending action from the server-side store.
2. **Recompute `hashAction` server-side and reject on mismatch. Never trust a client-supplied hash.**
3. Forward the **complete, unmodified** IDKit result to `https://developer.world.org/api/v4/verify/${rp_id}` — do not remap response identifiers.
4. On success: `recordApproval(nullifierHash)`, return a `HumanGateReceipt` with
   `expiresAt = now + RECEIPT_TTL_MS`, store it by `actionId`.

### Graceful degradation
Selfie Check is access-gated and may not be enabled for our app yet. If the preset is rejected, the
flow must **degrade to standard World ID verification without crashing**, logging one clear warning
naming the limitation. Keep the Selfie Check code path in the repo either way.

### Assurance honesty (judges will check)
Selfie Check is **medium-assurance and explicitly NOT one-person-one-account**. Any user-facing copy
you write says *"raises the cost of automated and repeated abuse"*. **Never** write "sybil-proof" or
"one person one account".

---

## Part C — the friction log (this is a scored deliverable)

Append to `notes/worldid-friction.md` **as things happen** — every confusing doc, missing error
message, undocumented field, dead link, SDK surprise. Format per entry: *what I tried → what I
expected → what happened → the exact error text.*

This becomes `FEEDBACK.md`, which is a hard qualification requirement for the World prize and is
directly graded. **It cannot be reconstructed from memory on Sunday.** Write as you go even if the
entry feels small. Structure under the existing headings (Hot / Cold / Semi-cold / Docs & Portal).

You cannot run the phone-side Sandbox states yourself — record what you hit from the SDK and docs
side, and leave the three Sandbox headings for the human to fill in.

## Constraints
- **Next.js 16.3.4 / React 19.2.8 / Tailwind 4.** Next 16 has breaking changes vs. your training data
  — `AGENTS.md` in the repo root says so. **Read the relevant guide in `node_modules/next/dist/docs/`
  before writing any route.** Do not write Next route handlers from memory.
- TypeScript strict. `npm run build` and `npx tsc --noEmit` must both pass before you commit.

## Definition of done
- [ ] `canonicalJson` + `hashAction` implemented, with all tests above passing
- [ ] Ambiguous values throw rather than silently coercing
- [ ] Continuity ledger works; second approval reports `isReturning: true`
- [ ] `assertValidReceipt` throws on expiry, id mismatch, hash mismatch, and replay — each with a distinct message
- [ ] Tamper test proves a one-byte payload change invalidates the receipt
- [ ] `HumanGate.tsx` replaced, stub contract preserved, `detail` extended to `{ actionId, receipt }`
- [ ] Verify route recomputes the hash server-side and forwards the IDKit result unmodified
- [ ] Degrades without crashing when Selfie Check is not enabled
- [ ] No "sybil-proof" / "one-person-one-account" claims anywhere
- [ ] `notes/worldid-friction.md` has real entries
- [ ] `npm run build` clean, `npx tsc --noEmit` clean, `node --test` green
- [ ] ≥ 4 commits, no files outside your ownership touched

Report at the end: what you built, what you could not verify without credentials, the `detail` shape
change, and any contract change you wanted in `src/lib/types.ts` but did not make.
