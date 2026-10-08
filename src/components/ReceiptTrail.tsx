"use client";

import { useI18n } from "@/i18n/client";
import type { AgentAction, HumanGateReceipt, RecipeRun } from "@/lib/types";
import type { TrailEntry } from "./dashboard-types";

const shorten = (value: string) => `${value.slice(0, 12)}...${value.slice(-6)}`;

function ReceiptEntry({ action, receipt }: { action: AgentAction; receipt: HumanGateReceipt }) {
  const { t, usd, time, plural } = useI18n();
  return <article className="rounded-xl border border-border border-l-2 border-l-ok bg-panel-raised p-3"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="text-xs font-semibold uppercase text-ok">{t.trail.approved}</span><span className="rounded-full border border-brand/40 px-2 py-0.5 text-[10px] font-semibold text-brand">{t.trail.credential[receipt.credentialType]}</span></span><time className="text-[10px] text-muted">{time(receipt.verifiedAt)}</time></div><p className="mt-3 font-mono text-xs text-foreground">{shorten(receipt.nullifierHash)}</p><div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted"><span>{receipt.continuity?.isReturning ? plural(t.trail.returningHuman, receipt.continuity.daysKnown) : t.trail.newHuman}</span><span>{usd(action.costUsd)}</span></div></article>;
}

function ExecutionEntry({ action, result }: { action: AgentAction; result: RecipeRun }) {
  const { t, usd, plural } = useI18n();
  return <article className="rounded-xl border border-border border-l-2 border-l-ok bg-panel-raised p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase text-ok">{t.trail.executed}</span><span className="text-xs text-foreground">{usd(result.costUsd)}</span></div><p className="mt-2 text-sm text-foreground">{result.status}</p><p className="mt-2 font-mono text-[10px] text-muted">{action.id} · {plural(t.trail.steps, result.steps.length)}{result.txHash ? ` · ${shorten(result.txHash)}` : ""}</p></article>;
}

function RejectionEntry({ action, message }: { action: AgentAction; message: string }) {
  const { t, usd } = useI18n();
  return <article className="rounded-xl border border-danger/40 border-l-2 bg-danger/10 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase text-danger">{t.trail.rejected}</span><span className="text-xs text-danger">{usd(action.costUsd)}</span></div><p className="mt-2 text-sm text-danger">{message}</p></article>;
}

export default function ReceiptTrail({ entries }: { entries: TrailEntry[] }) {
  const { t } = useI18n();
  return <section className="min-h-[620px] bg-panel p-5 sm:p-6" aria-labelledby="trail-heading"><div className="flex items-center justify-between border-b border-border pb-4"><h2 id="trail-heading" className="text-sm font-semibold text-foreground">{t.trail.heading}</h2><span className="text-xs text-muted">{t.trail.appendOnly}</span></div><div className="space-y-3 pt-5">{entries.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">{t.trail.empty}</p>}{[...entries].reverse().map((entry) => entry.kind === "approval" ? <ReceiptEntry key={entry.id} action={entry.action} receipt={entry.receipt} /> : entry.kind === "execution" ? <ExecutionEntry key={entry.id} action={entry.action} result={entry.result} /> : <RejectionEntry key={entry.id} action={entry.action} message={entry.message} />)}</div><div className="mt-8 border-t border-border pt-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{t.trail.policyHeading}</p><p className="mt-2 text-xs leading-5 text-muted">{t.trail.policy}</p></div></section>;
}
