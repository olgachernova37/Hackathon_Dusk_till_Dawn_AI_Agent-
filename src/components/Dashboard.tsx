"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HumanGate from "@/components/HumanGate";
// Pure and client-safe (HumanGate imports it too): lets the card show the real
// hash the Selfie Check proof will be bound to, before approval.
import { hashAction } from "@/lib/worldid/hash";
import ChatPane from "@/components/ChatPane";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ReceiptTrail from "@/components/ReceiptTrail";
import { useI18n } from "@/i18n/client";
import { executeAction, getLinkedAction, getWalletAssessment, planMessages } from "@/components/_api";
import type { DashboardState, TrailEntry } from "@/components/dashboard-types";
import type { AgentAction, ChatMessage, HumanGateReceipt, RiskAssessment } from "@/lib/types";

const shorten = (value: string) => `${value.slice(0, 12)}...${value.slice(-6)}`;

function riskTone(score: number, t: ReturnType<typeof useI18n>["t"]) {
  if (score >= 70) return { text: "text-danger", stroke: "var(--danger)", label: t.evidence.riskHigh };
  if (score >= 50) return { text: "text-warn", stroke: "var(--warn)", label: t.evidence.riskElevated };
  return { text: "text-ok", stroke: "var(--ok)", label: t.evidence.riskLow };
}

function LiveBadge({ queriedAt, subgraphId }: { queriedAt: number; subgraphId: string }) {
  const { t, fill } = useI18n();
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - queriedAt));
  useEffect(() => { const timer = window.setInterval(() => setElapsed(Math.max(0, Date.now() - queriedAt)), 1000); return () => window.clearInterval(timer); }, [queriedAt]);
  return <div className="flex flex-wrap items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" aria-hidden="true" /><span>{t.evidence.live}</span><span className="text-foreground">{fill(t.evidence.secondsAgo, { n: Math.floor(elapsed / 1000) })}</span><span className="text-muted">{subgraphId}</span></div>;
}

function EvidencePanel({ assessment, action, receipt, currentTime, onAttempt, onExecute }: { assessment: RiskAssessment | null; action: AgentAction | null; receipt: HumanGateReceipt | null; currentTime: number; onAttempt: () => Promise<void>; onExecute: () => Promise<void> }) {
  const { t, fill, usd, date } = useI18n();
  const tone = riskTone(assessment?.score ?? action?.riskScore ?? 0, t);
  const canExecute = Boolean(receipt && receipt.expiresAt > currentTime);
  return <section className="min-h-[620px] bg-panel p-5 sm:p-6" aria-labelledby="evidence-heading"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4"><div><h2 id="evidence-heading" className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{t.evidence.heading}</h2><p className="mt-2 font-mono text-xs text-foreground">{assessment?.evidence.address ?? t.evidence.awaiting}</p></div>{assessment && <LiveBadge queriedAt={assessment.evidence.source.queriedAt} subgraphId={assessment.evidence.source.subgraphId} />}</div>{assessment ? <><div className="mt-5 flex flex-wrap items-center gap-5"><div className="relative grid h-44 w-44 place-items-center"><svg viewBox="0 0 110 110" className="h-full w-full -rotate-90" role="img" aria-label={fill(t.evidence.riskAria, { score: assessment.score })}><circle cx="55" cy="55" r="45" fill="none" stroke="var(--border)" strokeWidth="8" /><circle cx="55" cy="55" r="45" fill="none" stroke={tone.stroke} strokeWidth="8" strokeDasharray={`${2 * Math.PI * 45 * assessment.score / 100} ${2 * Math.PI * 45 * (1 - assessment.score / 100)}`} /></svg><div className="absolute text-center"><div className={`font-mono text-4xl font-semibold ${tone.text}`}>{assessment.score}</div><div className="font-mono text-[10px] tracking-[0.18em] text-muted">{tone.label}</div></div></div><div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.evidence.sourceSubgraph}</p><p className="mt-2 font-mono text-sm text-brand">{assessment.evidence.source.subgraphId}</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[[t.evidence.transactions, String(assessment.evidence.txCount)], [t.evidence.counterparties, String(assessment.evidence.uniqueCounterparties)], [t.evidence.firstSeen, assessment.evidence.firstSeen ? date(assessment.evidence.firstSeen) : t.evidence.noneObserved], [t.evidence.volumeUsd, usd(assessment.evidence.totalVolumeUsd)]].map(([label, value]) => <div key={label} className="border border-border bg-panel-raised p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p><p className="mt-2 truncate font-mono text-sm text-foreground">{value}</p></div>)}</div><div className="mt-6"><h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{t.evidence.reasonsHeading}</h3>{assessment.reasons.length > 0 ? <ul className="mt-3 space-y-2">{assessment.reasons.map((reason) => <li key={reason} className="border-l-2 border-warn bg-panel-raised px-3 py-2 text-sm text-foreground">{reason}</li>)}</ul> : <p className="mt-3 border-l-2 border-ok bg-panel-raised px-3 py-2 text-sm text-foreground">{t.evidence.noReasons}</p>}</div></> : <div className="mt-8 border border-dashed border-border p-6 text-sm leading-6 text-muted">{t.evidence.empty}</div>}{action && <div className="mt-6 border border-warn/60 bg-warn/10 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">{t.evidence.pendingAction}</p><p className="mt-2 text-sm text-foreground">{action.summary}</p></div><span className="font-mono text-sm text-warn">{usd(action.costUsd)}</span></div><div className="mt-4 grid gap-2 font-mono text-xs text-muted sm:grid-cols-2"><span>{t.evidence.riskScore} <b className={tone.text}>{action.riskScore}</b></span><span title={hashAction(action.payload)}>{t.evidence.actionHash} {shorten(hashAction(action.payload))}</span></div><div className="mt-4"><HumanGate action={action} /></div>{!receipt && <button type="button" onClick={() => void onAttempt()} className="mt-2 w-full border border-danger px-4 py-3 text-sm font-semibold text-danger hover:bg-danger/10">{t.evidence.attemptWithoutApproval}</button>}<button type="button" disabled={!canExecute} onClick={() => void onExecute()} className="mt-2 w-full border border-border bg-panel-raised px-4 py-3 text-sm font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-100">{canExecute ? t.evidence.execute : t.evidence.blocked}</button></div>}</section>;
}

export default function Dashboard() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<DashboardState>({ assessment: null, messages: [], pendingAction: null, receipt: null, trail: [], isMock: false, linkNotice: null });
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const actionId = new URLSearchParams(window.location.search).get("action");
    if (!actionId) return;
    void getLinkedAction(actionId).then((action) => setState((current) => ({ ...current, pendingAction: action }))).catch(() => setState((current) => ({ ...current, linkNotice: t.dashboard.linkNotFound })));
  }, [t.dashboard.linkNotFound]);

  useEffect(() => {
    const approve = (event: Event) => {
      const detail = (event as CustomEvent<{ actionId?: string; receipt?: HumanGateReceipt }>).detail;
      setState((current) => {
        if (!current.pendingAction || detail.actionId !== current.pendingAction.id || !detail.receipt) return current;
        const entry: TrailEntry = { id: `approval-${Date.now()}`, kind: "approval", timestamp: Date.now(), action: current.pendingAction, receipt: detail.receipt };
        return { ...current, receipt: detail.receipt, trail: [...current.trail, entry] };
      });
    };
    window.addEventListener("human-gate:approved", approve);
    return () => window.removeEventListener("human-gate:approved", approve);
  }, []);

  // The wallet the evidence panel shows. The agent puts it in payload.address
  // (its system prompt and the server-side risk recompute both use that key);
  // payload.wallet is kept for older actions. With no proposal yet, fall back to
  // the address in the user's latest message — a plain "is 0x… safe?" question
  // must still light up the LIVE evidence, mirroring the server's pre-fetch.
  const evidenceAddress = useMemo(() => {
    const payload = state.pendingAction?.payload;
    const fromPayload = [payload?.address, payload?.wallet].find((value): value is string => typeof value === "string");
    if (fromPayload) return fromPayload;
    const latestUser = [...state.messages].reverse().find((message) => message.role === "user");
    return latestUser?.content.match(/0x[a-fA-F0-9]{40}/)?.[0];
  }, [state.pendingAction?.payload, state.messages]);

  useEffect(() => {
    if (!evidenceAddress) return;
    void getWalletAssessment(evidenceAddress).then((result) => setState((current) => ({ ...current, assessment: result.data, isMock: result.mocked })));
  }, [evidenceAddress]);

  async function submitMessage(content: string) {
    const user: ChatMessage = { id: `user-${Date.now()}`, role: "user", content };
    const messages = [...state.messages, user];
    setState((current) => ({ ...current, messages }));
    setBusy(true);
    try {
      const result = await planMessages(messages);
      setState((current) => ({ ...current, messages: [...current.messages, { id: `assistant-${Date.now()}`, role: "assistant", content: result.reply, action: result.action }], pendingAction: result.action ?? current.pendingAction }));
    } catch (error) {
      setState((current) => ({ ...current, messages: [...current.messages, { id: `system-${Date.now()}`, role: "system", content: error instanceof Error ? error.message : t.dashboard.planFailed }] }));
    } finally { setBusy(false); }
  }

  async function executeAndRecord() {
    if (!state.pendingAction) return;
    try {
      const result = await executeAction(state.pendingAction.id);
      const entry: TrailEntry = { id: `execution-${Date.now()}`, kind: "execution", timestamp: Date.now(), action: state.pendingAction, result };
      setState((current) => ({ ...current, trail: [...current.trail, entry] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t.dashboard.executionFailed;
      const entry: TrailEntry = { id: `rejection-${Date.now()}`, kind: "rejection", timestamp: Date.now(), action: state.pendingAction, message };
      setState((current) => ({ ...current, trail: [...current.trail, entry] }));
    }
  }

  return <main className="min-h-screen bg-background text-foreground">{state.isMock && <div className="sticky top-0 z-10 border-b border-warn bg-warn px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.14em] text-background">{t.dashboard.mockBanner}</div>}{state.linkNotice && <div className="border-b border-warn bg-warn/10 px-4 py-2 text-center text-sm text-warn">{state.linkNotice}</div>}<header className="border-b border-border px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">{t.dashboard.product}</p><h1 className="mt-1 text-xl font-semibold">{t.dashboard.console} <span className="font-mono text-xs font-normal text-muted">{t.dashboard.session}</span></h1></div><div className="flex flex-wrap items-center gap-5"><div className="font-mono text-xs text-muted">{t.dashboard.status}</div><Link href={`/${locale}/market`} className="font-mono text-xs uppercase tracking-[0.12em] text-brand hover:text-foreground">{t.market.product}</Link><LanguageSwitcher locale={locale} label={t.language.label} switchTo={t.language.switchTo} /></div></div></header><div className="mx-auto grid max-w-[1600px] gap-px bg-border p-px lg:grid-cols-[minmax(230px,0.8fr)_minmax(380px,1.5fr)_minmax(250px,0.9fr)]"><ChatPane messages={state.messages} busy={busy} onSubmit={submitMessage} /><EvidencePanel assessment={state.assessment} action={state.pendingAction} receipt={state.receipt} currentTime={currentTime} onAttempt={executeAndRecord} onExecute={executeAndRecord} /><ReceiptTrail entries={state.trail} /></div></main>;
}
