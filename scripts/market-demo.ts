/**
 * End-to-end marketplace demo against a running app (`npm run dev`).
 *
 *   node scripts/market-demo.ts                  # both stories
 *   node scripts/market-demo.ts small            # story A only
 *   node scripts/market-demo.ts large            # story B only
 *   MARKET_URL=https://… node scripts/market-demo.ts
 *
 * Story A — small deal ($0.02): buyer agent finds a translator, funds lock in
 *           escrow with no human, provider delivers, the judge accepts, escrow
 *           pays out. No Selfie Check anywhere.
 * Story B — large deal ($25): the same steps, but funding waits for a World ID
 *           Selfie Check, and so does the payout. The script prints the
 *           approval link and waits while you approve on your phone.
 *
 * Provider agents do the job through OpenAI when OPENAI_API_KEY is set; without
 * it the fixed sample below is delivered and recorded as entered manually.
 * Settlement is simulated: escrow is a ledger record, not on-chain funds.
 */

const BASE = (process.env.MARKET_URL ?? "http://localhost:3000").replace(/\/$/, "");
const POLL_MS = 3000;
const WAIT_LIMIT_MS = 10 * 60 * 1000;

export {};

interface DealView { id: string; status: string; funds: string; amountUsd: number; settlement: string; proposedOutcome?: string; output?: string }
interface ApiReply {
  error?: { code: string; message: string };
  deal: DealView;
  discovery: { reason: string };
  verdict: { verdict: string; confidence: number; reason: string };
  requiresHuman?: boolean;
  approvalUrl?: string;
}

async function call(path: string, body?: Record<string, unknown>): Promise<{ status: number; data: ApiReply }> {
  const response = await fetch(`${BASE}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  return { status: response.status, data: await response.json() as ApiReply };
}

async function must(path: string, body?: Record<string, unknown>): Promise<ApiReply> {
  const { status, data } = await call(path, body);
  if (status >= 400) throw new Error(`${path} → ${status}: ${data.error?.message ?? JSON.stringify(data)}`);
  return data;
}

const step = (n: number, text: string) => console.log(`\n  ${n}. ${text}`);
const show = (deal: DealView) => console.log(`     status: ${deal.status} · ${deal.funds}`);

/** Retries a gated step until the human has approved (or we give up). */
async function waitForHuman(path: string, dealId: string, link: string | undefined): Promise<ApiReply> {
  console.log(`\n     🧑 Human needed. Open this link and approve with Selfie Check:\n     ${link}\n     waiting…`);
  const started = Date.now();
  while (Date.now() - started < WAIT_LIMIT_MS) {
    const { status, data } = await call(path, { dealId });
    if (status < 400) return data;
    if (data.error?.code !== "AWAITING_HUMAN") throw new Error(`${path} → ${status}: ${data.error?.message}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("Gave up waiting for the Selfie Check");
}

async function story(title: string, order: { skill: string; task: string }, delivery: string): Promise<void> {
  console.log(`\n━━ ${title} ━━`);
  step(1, `Buyer agent needs "${order.skill}": ${order.task}`);
  const created = await must("/api/market/deals", { buyer: "buyer-agent", ...order });
  console.log(`     discovery: ${created.discovery.reason}`);
  let deal = created.deal;
  const dealId: string = deal.id;

  step(2, "Funding");
  if (created.requiresHuman) {
    console.log(`     $${deal.amountUsd} is above the limit agents may spend alone`);
    deal = (await waitForHuman("/api/market/deals/fund", dealId, created.approvalUrl)).deal;
  } else {
    console.log(`     $${deal.amountUsd} is within the limit — no human needed`);
  }
  show(deal);

  step(3, "Provider agent does the job");
  const worked = await call("/api/market/deals/work", { dealId });
  if (worked.status < 400) {
    deal = worked.data.deal;
    console.log(`     done by the provider's agent: ${deal.output?.slice(0, 120)}`);
  } else {
    // No model configured: deliver the fixed sample, recorded as entered manually.
    console.log(`     provider agent unavailable (${worked.data.error?.message}); delivering the sample text manually`);
    deal = (await must("/api/market/deals/deliver", { dealId, output: delivery })).deal;
  }
  show(deal);

  step(4, "Judge compares order and delivery");
  const judged = await must("/api/market/deals/judge", { dealId });
  console.log(`     verdict: ${judged.verdict.verdict} (${judged.verdict.confidence}) — ${judged.verdict.reason}`);
  deal = judged.deal;
  if (judged.requiresHuman) {
    console.log(`     outcome waits for a human: proposed ${deal.proposedOutcome}`);
    deal = (await waitForHuman("/api/market/deals/resolve", dealId, judged.approvalUrl)).deal;
  }

  step(5, "Escrow settles");
  show(deal);
  console.log(`     settlement: ${deal.settlement}`);
}

const which = process.argv[2] ?? "both";
try {
  if (which === "small" || which === "both") {
    await story("Story A — small deal, agents only", { skill: "translate", task: "Translate 'Good morning, the meeting is at 10' into Czech" }, "Dobré ráno, schůzka je v 10.");
  }
  if (which === "large" || which === "both") {
    await story(
      "Story B — large deal, human on the gate",
      { skill: "contract_audit", task: "Check this withdraw() for reentrancy: it sends ETH, then sets balance[msg.sender] = 0" },
      "Vulnerable: the external call happens before the balance is zeroed, so a malicious receiver can re-enter withdraw(). Fix: set the balance to 0 first (checks-effects-interactions) or add a reentrancy guard.",
    );
  }
  console.log("\nDone.\n");
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}\n   Is the app running at ${BASE}?`);
  process.exitCode = 1;
}
