"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HumanGate from "@/components/HumanGate";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import type { Deal, DealStatus, DiscoveryStrategy, Provider, ProviderRisk, Verdict } from "@/lib/market/types";
import type { AgentAction, HumanGateReceipt } from "@/lib/types";
import type { Dictionary } from "@/i18n/dictionaries/en";

type Phrase = keyof Dictionary["market"]["voice"];

/*
 * Marketplace deal console — one screen for the whole deal:
 * order → discovery → provider wallet on The Graph → Selfie Check (only when
 * needed) → escrow → delivery → judge → payout. Every step calls the real
 * /api/market routes; the provider's delivery is typed here because the
 * provider agents are simulated.
 */

type DealView = Deal & { funds: string; done: boolean };
type ApiError = { error?: { code?: string; message?: string } };
type CatalogReply = {
  providers: Provider[];
  skills: string[];
  autoApproveLimitUsd: number;
  settlement: { mode: "simulated" | "base-sepolia" | "sepolia"; network: string | null; buyerAddress: string | null; escrowAddress: string | null; escrowUrl: string | null };
  caps: { perPaymentUsd: number; dailyUsd: number; spentTodayUsd: number };
  graphGate: "enforce" | "advisory";
};
const shortHash = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

function TxLink({ label, tx }: { label: string; tx?: { hash: string; url: string } }) {
  if (!tx) return null;
  return <a href={tx.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-ok/50 bg-ok/10 px-3 py-2 font-mono text-xs text-ok hover:bg-ok/20"><span>{label}</span><span>{shortHash(tx.hash)} ↗</span></a>;
}
type CreateReply = { deal: DealView; discovery: { chosen: Provider; candidates: Provider[]; reason: string }; requiresHuman: boolean; approvalActionId?: string };
type Order = { skill: string; task: string; maxPriceUsd?: number; strategy?: DiscoveryStrategy; parsedBy: "openai" | "keywords" };
type AskReply = CreateReply & { order: Order };
type DealReply = { deal: DealView };
type JudgeReply = { deal: DealView; verdict: Verdict; requiresHuman: boolean; approvalActionId?: string };

async function api<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = (await response.json()) as T & ApiError;
  if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  return data;
}

const SAMPLES: Record<string, { task: string; delivery: string }> = {
  translate: { task: "Translate into Czech: \"Good morning, the meeting is at 10.\"", delivery: "Dobré ráno, schůzka je v 10." },
  summarize: { task: "Summarize in one line: \"The team shipped escrow, a judge and discovery overnight, and every payout now waits for proof of delivery.\"", delivery: "The team shipped an escrowed agent marketplace overnight where payouts follow verified delivery." },
  web_research: { task: "Research: what is the Masumi network for AI agents, and which blockchain does it use?", delivery: "Masumi is a payment network for AI agents with a registry and escrow, built on Cardano." },
  contract_audit: { task: "Check this withdraw() for reentrancy: it sends ETH first, then sets balance[msg.sender] = 0.", delivery: "Vulnerable: the external call runs before the balance is zeroed, so a malicious receiver can re-enter withdraw(). Fix: zero the balance first (checks-effects-interactions) or add a reentrancy guard." },
};

/** The two demo stories, asked in plain words so the buyer agent has to understand them. */
const DEMO_REQUESTS = [
  "Translate into Czech, cheapest provider please: \"Good morning, the meeting is at 10.\"",
  "Audit this Solidity withdraw() for reentrancy: it sends ETH to msg.sender first, then sets balance[msg.sender] = 0.",
];

const STEPS = ["found", "approved", "locked", "delivered", "judged", "settled"] as const;
type Step = (typeof STEPS)[number];

function reachedSteps(deal: DealView | null): Set<Step> {
  const reached = new Set<Step>();
  if (!deal) return reached;
  reached.add("found");
  const order: DealStatus[] = ["awaiting_approval", "funded", "delivered", "disputed", "released"];
  const rank = deal.status === "refunded" ? (deal.history.some((h) => h.event === "deliver") ? 4 : 1) : deal.status === "cancelled" ? 0 : order.indexOf(deal.status);
  if (rank >= 1) { reached.add("approved"); reached.add("locked"); }
  if (rank >= 2) reached.add("delivered");
  if (deal.verdict) reached.add("judged");
  if (deal.status === "released" || deal.status === "refunded") reached.add("settled");
  return reached;
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`bg-panel p-5 sm:p-6 ${className}`}><h2 className="border-b border-border pb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted">{title}</h2><div className="pt-4">{children}</div></section>;
}

function GraphTile({ risk, advisory }: { risk: ProviderRisk; advisory: boolean }) {
  const { t, usd, date, time, fill } = useI18n();
  if (!risk.available) {
    return <div className="border border-warn/60 bg-warn/10 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">{advisory ? t.market.graphAdvisory : t.market.graphUnavailable}</p><p className="mt-2 text-sm text-foreground">{risk.reasons[0]}</p></div>;
  }
  const score = risk.score ?? 0;
  const tone = score >= 70 ? "text-danger" : score >= 50 ? "text-warn" : "text-ok";
  return (
    <div className="border border-border bg-panel-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.providerWallet}</p>
          <p className="mt-1 break-all font-mono text-xs text-foreground">{risk.address}</p>
        </div>
        {risk.source && <span className="inline-flex items-center gap-2 border border-ok/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ok" title={fill(t.market.queriedAt, { time: time(risk.source.queriedAt) })}><span className="h-2 w-2 animate-pulse rounded-full bg-ok" aria-hidden="true" />{t.evidence.live}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[[t.market.riskScore, String(score)], [t.evidence.transactions, String(risk.txCount ?? 0)], [t.evidence.firstSeen, risk.firstSeen ? date(risk.firstSeen) : t.evidence.noneObserved], [t.evidence.volumeUsd, usd(risk.totalVolumeUsd ?? 0)]].map(([label, value], index) => (
          <div key={label} className="border border-border bg-panel p-2"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p><p className={`mt-1 truncate font-mono text-sm ${index === 0 ? tone : "text-foreground"}`}>{value}</p></div>
        ))}
      </div>
      {advisory && <p className="mt-3 font-mono text-[10px] text-warn">{t.market.graphAdvisory}</p>}
      {risk.source && <p className="mt-3 font-mono text-[10px] text-muted">{t.evidence.sourceSubgraph}: <span className="text-brand">{risk.source.subgraphId}</span></p>}
      {risk.reasons.length > 0
        ? <ul className="mt-3 space-y-1">{risk.reasons.map((reason) => <li key={reason} className="border-l-2 border-warn px-2 text-xs text-foreground">{reason}</li>)}</ul>
        : <p className="mt-3 border-l-2 border-ok px-2 text-xs text-foreground">{t.evidence.noReasons}</p>}
    </div>
  );
}

export default function MarketConsole() {
  const { locale, t, usd, time, fill } = useI18n();
  const [catalog, setCatalog] = useState<CatalogReply | null>(null);
  const [skill, setSkill] = useState("translate");
  const [task, setTask] = useState(SAMPLES.translate.task);
  const [strategy, setStrategy] = useState<DiscoveryStrategy>("cheapest");
  const [deal, setDeal] = useState<DealView | null>(null);
  const [discovery, setDiscovery] = useState<CreateReply["discovery"] | null>(null);
  const [approval, setApproval] = useState<AgentAction | null>(null);
  const [delivery, setDelivery] = useState(SAMPLES.translate.delivery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  /** Autopilot: requests still to run; null when the demo is not running. */
  const [demoQueue, setDemoQueue] = useState<string[] | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const spoken = useRef<string>("");

  /** ElevenLabs when the server has a key; otherwise the browser's own voice. */
  const say = useCallback(async (phrase: Phrase) => {
    try {
      const response = await fetch("/api/market/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phrase, locale }) });
      if (response.ok) {
        const url = URL.createObjectURL(await response.blob());
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        return;
      }
    } catch { /* fall through to browser speech */ }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(t.market.voice[phrase]);
      utterance.lang = locale === "uk" ? "uk-UA" : locale === "cs" ? "cs-CZ" : "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [locale, t.market.voice]);

  // Reloaded whenever a deal changes state, so "spent today" stays current.
  useEffect(() => {
    void api<CatalogReply>("/api/market/providers").then(setCatalog).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [deal?.status]);

  const run = useCallback(async (work: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try { await work(); return true; } catch (e) { setError(e instanceof Error ? e.message : String(e)); setDemoQueue(null); return false; } finally { setBusy(false); }
  }, []);

  const loadApproval = useCallback(async (actionId?: string) => {
    setApproval(actionId ? await api<AgentAction>(`/api/gateway/action?id=${encodeURIComponent(actionId)}`) : null);
  }, []);

  // When the Selfie Check passes, finish the gated step on the server.
  useEffect(() => {
    const onApproved = (event: Event) => {
      const detail = (event as CustomEvent<{ actionId?: string; receipt?: HumanGateReceipt }>).detail;
      if (!deal || !approval || detail.actionId !== approval.id) return;
      const path = deal.status === "disputed" ? "/api/market/deals/resolve" : "/api/market/deals/fund";
      void run(async () => {
        const reply = await api<DealReply>(path, { dealId: deal.id });
        setDeal(reply.deal);
        setApproval(null);
      });
    };
    window.addEventListener("human-gate:approved", onApproved);
    return () => window.removeEventListener("human-gate:approved", onApproved);
  }, [deal, approval, run]);

  function choosePreset(next: string) {
    setSkill(next);
    setTask(SAMPLES[next]?.task ?? "");
    setDelivery(SAMPLES[next]?.delivery ?? "");
  }

  const startDeal = () => run(async () => {
    setDeal(null); setDiscovery(null); setApproval(null); setOrder(null);
    const reply = await api<CreateReply>("/api/market/deals", { buyer: "buyer-agent", skill, task, strategy });
    setDeal(reply.deal);
    setDiscovery(reply.discovery);
    await loadApproval(reply.approvalActionId);
  });

  const ask = useCallback((message: string) => run(async () => {
    setDeal(null); setDiscovery(null); setApproval(null); setOrder(null);
    const reply = await api<AskReply>("/api/market/ask", { buyer: "buyer-agent", message });
    setOrder(reply.order);
    setSkill(reply.order.skill);
    setTask(reply.order.task);
    setDelivery(SAMPLES[reply.order.skill]?.delivery ?? "");
    setDeal(reply.deal);
    setDiscovery(reply.discovery);
    await loadApproval(reply.approvalActionId);
  }), [run, loadApproval]);

  const retryFunding = () => run(async () => {
    if (!deal) return;
    setDeal((await api<DealReply>("/api/market/deals/fund", { dealId: deal.id })).deal);
  });

  const deliver = () => run(async () => {
    if (!deal) return;
    setDeal((await api<DealReply>("/api/market/deals/deliver", { dealId: deal.id, output: delivery })).deal);
  });

  /** The provider's own agent does the job; without a model, the demo falls back to the sample, marked as manual. */
  const work = useCallback((fallback: boolean) => run(async () => {
    if (!deal) return;
    try {
      setDeal((await api<DealReply>("/api/market/deals/work", { dealId: deal.id })).deal);
    } catch (e) {
      const sample = SAMPLES[deal.skill]?.delivery;
      if (!fallback || !sample) throw e;
      setDeal((await api<DealReply>("/api/market/deals/deliver", { dealId: deal.id, output: sample })).deal);
    }
  }), [deal, run]);

  const judgeDeal = useCallback(() => run(async () => {
    if (!deal) return;
    const reply = await api<JudgeReply>("/api/market/deals/judge", { dealId: deal.id });
    setDeal(reply.deal);
    await loadApproval(reply.approvalActionId);
  }), [deal, run, loadApproval]);

  // Autopilot: advance the current deal one step at a time; pause on a Selfie
  // Check (the human finishes it); move to the next story once settled.
  useEffect(() => {
    if (!demoQueue || busy || approval) return;
    const timer = window.setTimeout(() => {
      if (!deal || deal.done) {
        const [next, ...rest] = demoQueue;
        if (next === undefined) { setDemoQueue(null); return; }
        setDemoQueue(rest);
        setRequest(next);
        void ask(next);
      } else if (deal.status === "funded") void work(true);
      else if (deal.status === "delivered" && !deal.verdict) void judgeDeal();
    }, deal?.done ? 2500 : 900);
    return () => window.clearTimeout(timer);
  }, [demoQueue, busy, approval, deal, ask, work, judgeDeal]);

  const startDemo = () => { setDeal(null); setDiscovery(null); setApproval(null); setOrder(null); setDemoQueue([...DEMO_REQUESTS]); };

  // Speak each new moment of the deal once: a gate, escrow, a verdict, the payout.
  useEffect(() => {
    if (!voiceOn || !deal) return;
    const phrase: Phrase | null =
      approval ? "gateNeeded"
      : deal.status === "released" ? "paid"
      : deal.status === "refunded" ? "refunded"
      : deal.verdict && deal.status === "disputed" ? "judgeUnsure"
      : deal.verdict?.verdict === "accepted" ? "judgeAccepted"
      : deal.verdict?.verdict === "rejected" ? "judgeRejected"
      : deal.status === "funded" ? "funded"
      : null;
    if (!phrase) return;
    const key = `${deal.id}:${phrase}:${approval?.id ?? ""}`;
    if (spoken.current === key) return;
    spoken.current = key;
    void say(phrase);
  }, [voiceOn, deal, approval, say, t.market.voice]);

  const reached = useMemo(() => reachedSteps(deal), [deal]);
  const limit = catalog?.autoApproveLimitUsd ?? 1;
  const statusTone = deal?.status === "released" ? "text-ok" : deal?.status === "refunded" || deal?.status === "cancelled" ? "text-danger" : "text-warn";

  return (
    <main className="min-h-screen bg-background text-foreground">
      {catalog && catalog.settlement.mode !== "simulated"
        ? <div className="border-b border-ok bg-ok/10 px-4 py-2 text-center text-xs text-ok">{fill(t.market.onchainBanner, { network: catalog.settlement.network ?? "", per: usd(catalog.caps.perPaymentUsd), day: usd(catalog.caps.dailyUsd), spent: usd(catalog.caps.spentTodayUsd) })}{catalog.settlement.escrowUrl && <> · <a className="underline" target="_blank" rel="noreferrer" href={catalog.settlement.escrowUrl}>{t.market.escrowWallet} ↗</a></>}</div>
        : <div className="border-b border-warn bg-warn/10 px-4 py-2 text-center text-xs font-semibold text-warn">{t.market.simulatedBanner}</div>}
      <header className="border-b border-border px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">{t.market.product}</p>
            <h1 className="mt-1 text-xl font-semibold">{t.market.console}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" aria-pressed={voiceOn} onClick={() => setVoiceOn((on) => !on)} className={`border px-3 py-2 text-xs ${voiceOn ? "border-ok text-ok" : "border-border text-muted hover:text-foreground"}`}>{voiceOn ? t.market.voiceOn : t.market.voiceOff}</button>
            {demoQueue
              ? <span className="flex items-center gap-3"><span className="font-mono text-xs uppercase tracking-[0.12em] text-warn">{approval ? t.market.demoWaiting : t.market.demoRunning}</span><button type="button" onClick={() => setDemoQueue(null)} className="border border-border px-3 py-2 text-xs text-muted hover:text-foreground">{t.market.stopDemo}</button></span>
              : <button type="button" disabled={busy} onClick={startDemo} className="border border-brand px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50">{t.market.runDemo}</button>}
            <Link href={`/${locale}/dashboard`} className="font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-foreground">{t.market.backToCopilot}</Link>
            <LanguageSwitcher locale={locale} label={t.language.label} switchTo={t.language.switchTo} />
          </div>
        </div>
      </header>

      {error && <div role="alert" className="border-b border-danger bg-danger/10 px-4 py-2 text-center text-sm text-danger">{error}</div>}

      <div className="mx-auto grid max-w-[1600px] gap-px bg-border p-px lg:grid-cols-[minmax(260px,0.9fr)_minmax(380px,1.5fr)_minmax(250px,0.9fr)]">
        {/* ------------------------------------------------ order + discovery */}
        <div className="grid content-start gap-px bg-border">
          <Panel title={t.market.orderHeading}>
            <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted" htmlFor="market-ask">{t.market.askLabel}</label>
            <textarea id="market-ask" value={request} onChange={(e) => setRequest(e.target.value)} rows={3} placeholder={t.market.askPlaceholder} className="mt-2 w-full resize-y border border-border bg-panel-raised px-3 py-2 text-sm" />
            <button type="button" disabled={busy || !request.trim()} onClick={() => void ask(request)} className="mt-3 w-full bg-brand px-4 py-3 text-sm font-semibold text-background disabled:opacity-50">{t.market.askButton}</button>
            {order && <p className="mt-3 border-l-2 border-brand px-3 text-xs text-foreground">{fill(t.market.understood, { skill: order.skill, by: t.market.parsedBy[order.parsedBy] })}{order.maxPriceUsd !== undefined ? ` · ≤ ${usd(order.maxPriceUsd)}` : ""}</p>}
            <details className="mt-5 border-t border-border pt-4">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.orFillForm}</summary>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => choosePreset("translate")} className={`border p-3 text-left text-sm ${skill === "translate" ? "border-brand bg-brand/10" : "border-border bg-panel-raised"}`}><span className="block font-semibold">{t.market.presetSmall}</span><span className="mt-1 block text-xs text-muted">{t.market.presetSmallHint}</span></button>
              <button type="button" onClick={() => choosePreset("contract_audit")} className={`border p-3 text-left text-sm ${skill === "contract_audit" ? "border-brand bg-brand/10" : "border-border bg-panel-raised"}`}><span className="block font-semibold">{t.market.presetLarge}</span><span className="mt-1 block text-xs text-muted">{t.market.presetLargeHint}</span></button>
            </div>
            <label className="mt-4 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted" htmlFor="market-skill">{t.market.skillLabel}</label>
            <select id="market-skill" value={skill} onChange={(e) => choosePreset(e.target.value)} className="mt-2 w-full border border-border bg-panel-raised px-3 py-2 text-sm">
              {(catalog?.skills ?? ["translate"]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="mt-4 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted" htmlFor="market-task">{t.market.taskLabel}</label>
            <textarea id="market-task" value={task} onChange={(e) => setTask(e.target.value)} rows={4} className="mt-2 w-full resize-y border border-border bg-panel-raised px-3 py-2 text-sm" />
            <fieldset className="mt-4">
              <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.strategyLabel}</legend>
              <div className="mt-2 flex gap-4 text-sm">
                {(["cheapest", "best_rated"] as const).map((option) => <label key={option} className="flex items-center gap-2"><input type="radio" name="strategy" checked={strategy === option} onChange={() => setStrategy(option)} />{option === "cheapest" ? t.market.cheapest : t.market.bestRated}</label>)}
              </div>
            </fieldset>
            <button type="button" disabled={busy || !task.trim()} onClick={() => void startDeal()} className="mt-5 w-full border border-brand px-4 py-3 text-sm font-semibold text-brand disabled:opacity-50">{t.market.findProvider}</button>
            </details>
            <p className="mt-3 text-xs text-muted">{fill(t.market.policyNote, { limit: usd(limit) })}</p>
          </Panel>

          <Panel title={t.market.discoveryHeading}>
            {!discovery ? <p className="border border-dashed border-border p-4 text-sm text-muted">{t.market.discoveryEmpty}</p> : (
              <>
                <ul className="space-y-2">
                  {discovery.candidates.map((p) => {
                    const chosen = p.id === discovery.chosen.id;
                    return <li key={p.id} className={`border p-3 ${chosen ? "border-ok bg-ok/10" : "border-border bg-panel-raised"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{p.name}</span>{chosen && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ok">{t.market.chosen}</span>}</div><p className="mt-1 font-mono text-xs text-muted">{usd(p.priceUsd)} · ★ {p.rating} · {fill(t.market.jobs, { n: p.jobs })}</p></li>;
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted">{discovery.reason}</p>
              </>
            )}
          </Panel>
        </div>

        {/* ------------------------------------------------------- the deal */}
        <div className="grid content-start gap-px bg-border">
          <Panel title={t.market.dealHeading}>
            {!deal ? <p className="border border-dashed border-border p-4 text-sm text-muted">{t.market.dealEmpty}</p> : (
              <>
                <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {STEPS.map((step) => <li key={step} className={`break-words border px-1 py-2 text-center font-mono text-[9px] uppercase leading-tight tracking-normal ${reached.has(step) ? "border-ok text-ok" : "border-border text-muted"}`}>{t.market.steps[step]}</li>)}
                </ol>
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border border-border bg-panel-raised p-4">
                  <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.status}</p><p className={`mt-1 font-mono text-lg ${statusTone}`}>{t.market.statuses[deal.status]}</p></div>
                  <div className="text-right"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.escrow}</p><p className="mt-1 text-sm text-foreground">{deal.funds}</p></div>
                </div>
                {deal.settlement === "simulated" && <p className="mt-3 border border-warn px-3 py-2 text-center font-mono text-xs font-bold tracking-[0.14em] text-warn">SIMULATED</p>}
                <div className="mt-3 space-y-2">
                  <TxLink label={t.market.txLocked} tx={deal.fundingTx} />
                  <TxLink label={deal.status === "refunded" ? t.market.txRefunded : t.market.txReleased} tx={deal.payoutTx} />
                </div>
                {deal.paymentError && (
                  <div className="mt-3 border border-danger/60 bg-danger/10 p-3 text-sm text-danger">
                    <p>{deal.paymentError}</p>
                    {deal.status === "awaiting_approval" && !deal.fundingRequiresHuman && <button type="button" disabled={busy} onClick={() => void retryFunding()} className="mt-2 border border-danger px-3 py-1 text-xs font-semibold hover:bg-danger/10 disabled:opacity-50">{t.market.retryPayment}</button>}
                  </div>
                )}
              </>
            )}
          </Panel>

          {deal && (
            <Panel title={t.market.graphHeading}>
              <GraphTile risk={deal.providerRisk} advisory={catalog?.graphGate === "advisory"} />
            </Panel>
          )}

          {deal && (
            <Panel title={t.market.gateHeading}>
              {approval ? (
                <div className="border border-warn/60 bg-warn/10 p-4">
                  <p className="text-sm text-foreground">{approval.summary}</p>
                  <ul className="mt-2 space-y-1">{approval.riskReasons.map((reason) => <li key={reason} className="text-xs text-warn">• {reason}</li>)}</ul>
                  <div className="mt-4"><HumanGate action={approval} /></div>
                </div>
              ) : deal.fundingRequiresHuman || deal.disputeActionId ? (
                <p className="border-l-2 border-ok px-3 text-sm text-foreground">{t.market.gateDone}</p>
              ) : (
                <p className="border-l-2 border-border px-3 text-sm text-muted">{fill(t.market.gateSkipped, { limit: usd(limit) })}</p>
              )}
            </Panel>
          )}

          {deal && (deal.status === "funded" || deal.output) && (
            <Panel title={t.market.providerHeading}>
              {deal.status === "funded" ? (
                <>
                  <button type="button" disabled={busy} onClick={() => void work(false)} className="w-full bg-brand px-4 py-3 text-sm font-semibold text-background disabled:opacity-50">{t.market.providerWork}</button>
                  <details className="mt-4">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.market.manualDelivery}</summary>
                    <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted" htmlFor="market-delivery">{t.market.deliveryLabel}</label>
                    <textarea id="market-delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)} rows={3} className="mt-2 w-full resize-y border border-border bg-panel-raised px-3 py-2 text-sm" />
                    <p className="mt-1 text-xs text-muted">{t.market.deliverySimulated}</p>
                    <button type="button" disabled={busy || !delivery.trim()} onClick={() => void deliver()} className="mt-3 w-full border border-brand px-4 py-3 text-sm font-semibold text-brand disabled:opacity-50">{t.market.deliver}</button>
                  </details>
                </>
              ) : (
                <>
                  <p className={`font-mono text-[10px] uppercase tracking-[0.14em] ${deal.deliveredBy === "provider_agent" ? "text-ok" : "text-warn"}`}>{deal.deliveredBy === "provider_agent" ? t.market.deliveredByAgent : t.market.deliveredManually}</p>
                  <p className="mt-2 whitespace-pre-wrap border border-border bg-panel-raised p-3 text-sm">{deal.output}</p>
                </>
              )}
            </Panel>
          )}

          {deal && (deal.status === "delivered" || deal.verdict) && (
            <Panel title={t.market.judgeHeading}>
              {deal.verdict ? (
                <div className="border border-border bg-panel-raised p-4">
                  <p className={`font-mono text-sm uppercase ${deal.verdict.verdict === "accepted" ? "text-ok" : deal.verdict.verdict === "rejected" ? "text-danger" : "text-warn"}`}>{t.market.verdicts[deal.verdict.verdict]} · {Math.round(deal.verdict.confidence * 100)}%</p>
                  <p className="mt-2 text-sm text-foreground">{deal.verdict.reason}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted">{deal.verdict.judgedBy === "openai" ? t.market.judgedByModel : t.market.judgeUnavailable}</p>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => void judgeDeal()} className="w-full border border-brand px-4 py-3 text-sm font-semibold text-brand disabled:opacity-50">{t.market.runJudge}</button>
              )}
            </Panel>
          )}
        </div>

        {/* --------------------------------------------------------- history */}
        <Panel title={t.market.historyHeading} className="min-h-[620px]">
          {!deal ? <p className="border border-dashed border-border p-4 text-sm text-muted">{t.market.historyEmpty}</p> : (
            <ol className="space-y-3">
              {[...deal.history].reverse().map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="border border-border border-l-2 border-l-brand bg-panel-raised p-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs uppercase text-brand">{t.market.statuses[entry.status]}</span><time className="text-[10px] text-muted">{time(entry.at)}</time></div>
                  <p className="mt-2 text-xs leading-5 text-foreground">{entry.note}</p>
                </li>
              ))}
            </ol>
          )}
          {deal && <p className="mt-6 border-t border-border pt-4 font-mono text-[10px] text-muted">{t.market.settlementLabel}: {deal.settlement} · {deal.id}</p>}
        </Panel>
      </div>
    </main>
  );
}
