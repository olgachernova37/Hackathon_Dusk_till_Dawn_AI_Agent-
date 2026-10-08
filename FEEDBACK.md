# World ID / Selfie Check — integration feedback

Feedback from building **Human-Gated AI Copilot** at ETHOnline 2026 (11–13 Sep 2026), where Selfie
Check is the gate on every consequential agent action. Written as we hit each thing, not
reconstructed afterwards; the raw log is [`notes/worldid-friction.md`](notes/worldid-friction.md).

**Integration shape, for context:** desktop web (Next.js 16). IDKit renders a QR code, the World App
completes Selfie Check, and our server verifies the proof. The World ID **`signal` is
`keccak256(canonicalJson(action.payload))`**, so a proof authorises *one specific action* rather than
a session.

## The headline: two access gates, and the docs disagree with reality

This cost us the most time of anything in the integration, and both cases were documentation, not code.

1. **Selfie Check "access-gating" may not exist.** [credentials/11](https://docs.world.org/world-id/credentials/11)
   carries a Warning: *"Selfie Check (Beta) is access-gated. To use it, request access so the feature
   flag can be enabled for your app."* The SDK repeats it: *"Preview: Selfie Check is currently in
   preview. Contact us if you need it enabled."* We emailed developers@toolsforhumanity.com and got
   no reply for hours, then asked in the ETHGlobal Discord — where the World team answered that **no
   access is needed**. With a 46-hour hackathon, we had already designed a fallback path around a
   gate that reportedly isn't there.
   **Confirmed empirically:** on 2026-09-12 at 17:54 CEST we completed a full Selfie Check
   end-to-end in **`environment: production`** with the **ordinary World App from the Play Store** —
   no feature flag, no Sandbox build, no reply to our email. The credential works out of the box for
   a production `app_id`. The Warning cost us a day of planning around a gate that does not exist.
   **Suggestion:** state the real status on credentials/11 and in the SDK note, or show the flag
   state per app in the Developer Portal so a developer can check it in five seconds.

2. **Sandbox app access is self-serve, but documented as if it isn't.**
   [testing-selfie-check](https://docs.world.org/world-id/sandbox/testing-selfie-check) says
   *"Feature access requires enablement through your World point of contact before testing begins"*.
   The actual path is self-serve: **Developer Portal → World ID Sandbox → Android/iOS tab → submit
   the Google/Apple account email**. We only found it by reading
   [sandbox-access](https://docs.world.org/world-id/sandbox/sandbox-access).
   **Suggestion:** put the self-serve path first on the testing page, with the expected approval
   time — approval isn't instant, so it cannot be done on demo morning.

## SelfieCheck docs and integration flow

- **`signal_hash` is not the signal — and this one silently breaks everything.** We compared
  `responses[0].signal_hash` to the signal we passed and expected equality. It is
  `hashSignal(signal)`, a field-element hash, so the comparison can never match and **every genuine
  proof is rejected**. Nothing in the docs sits next to the response shape to say so; we found it by
  reading `idkit-core`'s type declarations and noticing it exports `hashSignal`. A backend that
  checks the signal (the whole point of binding a signal) will fail 100% of the time, and only once
  real credentials exist — the worst possible moment.
  **It bit us twice.** After fixing the server we hit it again in the client: our widget handler
  made the same comparison and rejected a **genuine, camera-completed Selfie Check** at the last
  step, showing "signal mismatch" to a user who had just proven they were human. Two independent
  developers reading the same field name made the same wrong assumption.
  **Suggestion:** one line by the response shape: *"compare against `hashSignal(yourSignal)`"*.
- **The RP signature format is easy to get wrong and fails invisibly.** Our first implementation
  EIP-191-signed `JSON.stringify(rpContext)`. The real message is binary:
  `version || nonce(32) || createdAt_u64_be || expiresAt_u64_be || action(32)`, with a specially
  derived nonce. Nothing fails at build time; the World App would simply reject every request.
  `@worldcoin/idkit-server`'s `signRequest` does it correctly, but we found that package by listing
  `node_modules`, not from the integration guide.
  **Suggestion:** link `signRequest` from the React/JS setup pages, where the RP signature is first
  mentioned, and say plainly "do not hand-roll this".
- **The response shape isn't mirror-symmetric with the request.** We expected the nullifier and
  signal at the top level; both live inside `responses[]`, alongside `issuer_schema_id` and
  `expires_at_min` (which v4 verification requires — we learned that from a validation error, not the
  docs).
- **`selfieCheckLegacy` returning World ID 3.0 proofs while `allow_legacy_proofs` is a separate
  widget flag** took a careful read to get right. Worth an explicit example.
- **What worked well:** the credential page is genuinely clear about *assurance* — medium, not
  one-person-one-account, 90-day validity. That honesty shaped our product: we use the 90-day window
  as a **continuity** signal and we never claim sybil resistance.

## Developer Portal: navigation, search, product discovery, debugging guidance

- **Where the RP signing key lives is undocumented.** [idkit/signatures](https://docs.world.org/world-id/idkit/signatures)
  says to *"obtain the `signing_key` from the Developer Portal"* — but not where in the Portal,
  whether it is shown only once, or how to rotate it. `integrate` mentions it in passing ("Keep these
  values: `app_id`, `rp_id`, `signing_key`"), which implies it appears during RP registration, but a
  developer who navigated away has no documented recovery path.
  **Suggestion:** name the exact Portal screen, and document rotation.
- **Two different testing stories, no comparison.** `integrate` says *"use the simulator and set
  `environment` to `staging`"*; the Sandbox pages describe `environment: sandbox` with a separate
  installed app. Both are valid, they need different setup, and **only one supports Selfie Check** —
  something we still can't confirm from the docs. A short table (simulator vs Sandbox vs production:
  what each supports) would have saved us an hour of planning.
- **[Get Prices](https://docs.world.org/api-reference/developer-portal/get-prices) rejects callers
  its own spec accepts.** Documented as `security: []` with no required headers. Every call to
  `GET https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?cryptoCurrencies=WLD,USDC&fiatCurrencies=USD`
  returns `{"code":"AU-001","message":"App update required"}` — same on `app-backend.worldcoin.dev`,
  and with `client-version`, `x-app-version`, `app-version` and a World App `User-Agent`. We wanted
  it as the sponsor price feed in our Bazantic recipe and had to drop it.
  **Suggestion:** document the header AU-001 wants, or mark the endpoint World-App-only.
- **Good:** `docs.world.org/llms.txt` is excellent. It is the single best thing in the developer
  experience for an AI-assisted build, and it is how we found most pages quickly.

## Sandbox App: states, proof flows, test users, errors, edge cases

- **We shipped without Sandbox at all.** Requested Android tester access 2026-09-11 ~23:00 CEST
  (Developer Portal → World ID Sandbox). **No approval had arrived ~19 hours later, by submission.**
  Meanwhile the flow was verified in **production** with the ordinary World App, so the notes below
  are from the docs and SDK surface rather than a Sandbox device. **We claim no Sandbox device
  results, because we have none.** The practical lesson for a weekend hackathon: the documented
  testing path was the one we could not use, and the undocumented one (production) worked first try.
- **Documented limitations we planned around:** Sandbox builds aren't publicly listed (TestFlight /
  private Play link); the **Semi-cold** journey (reinstall → account recovery → Selfie Check) is
  reliable on Android but has gaps on iOS around invite-code redemption; invite-code handling differs
  per platform. Because of that we chose **Android** as the demo device — a decision driven entirely
  by that one documentation paragraph, which was genuinely useful.
- **Is Sandbox even required for a production app id? Nothing says.** Our Developer Portal app id is
  a **production** id (`app_...`, not `app_staging_...`), yet every page routed us to
  `environment: sandbox` plus a gated Sandbox build. We are not alone: in the ETHGlobal Discord on
  2026-09-12 another participant reported that the Sandbox build appears to be the same app as
  production, that the World App UI had just been updated, and that the profile section now offers a
  World ID download — asking *"what's the point of beta testing on the sandbox app when we can do it
  in production"* and receiving no answer. Between the two of us that is a day of hackathon time
  spent on an environment question.
  **Suggestion:** state plainly which `environment` value matches which app id, and when Sandbox is
  genuinely required versus optional. One sentence would have saved us both.
- **The Hot / Cold / Semi-cold framing is good** and we structured our test plan around it.
- **Gap:** the Sandbox pages don't say how to **create** a test user, only that accounts are
  resettable ("delete and recreate freely"). A first-time integrator doesn't know whether a test user
  is created in the app, in the Portal, or automatically.
- **Gap:** nothing documents what the **desktop QR handoff** looks like in Sandbox — whether the
  Sandbox app scans the same QR as production, and what a mismatched environment error looks like.
  We had to reason about that from the IDKit `environment` union type.

## What was confusing, missing, broken, or hard to test

Ranked by how much time each cost us:

1. **Access gating that contradicts itself** (both Selfie Check and Sandbox) — hours, plus a fallback
   design we may not have needed.
2. **`signal_hash` vs `hashSignal(signal)`** — failed 100% of real verifications, twice (server and
   client). It rejected a completed Selfie Check in production; found only by reading type
   declarations. This is the single highest-value doc fix on this list.
3. **RP signature format** — no compile-time or runtime hint; silent rejection by the World App.
   `signRequest` exists but is undiscoverable from the integration guide.
4. **RP signing key provenance** — not documented where it appears or how to rotate it.
5. **Simulator vs Sandbox vs production** — no comparison of what each supports.
6. **Get Prices API** — documented as open, rejects all external callers.
7. **Minor, but real:** the `verify` endpoint is unauthenticated (`security: []`), which is easy to
   miss; we initially required an API key that turned out to be unnecessary.

**What we'd tell the next team:** the protocol design is sound and the assurance documentation is
admirably honest. Almost all of our lost time was **documentation drift** — pages describing an
older gate, an SDK helper that isn't linked from the guide that needs it, and one endpoint whose spec
no longer matches its behaviour.
