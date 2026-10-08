"use client";

import { useEffect, useMemo, useState } from "react";
import { IDKitInviteCodeRequestWidget, deviceLegacy, selfieCheckLegacy, type IDKitResult } from "@worldcoin/idkit";
import { clientEnv } from "@/lib/env";
import { useI18n } from "@/i18n/client";
import { hashAction } from "@/lib/worldid/hash";
import type { AgentAction, HumanGateReceipt, RpContext } from "@/lib/types";

type HumanGateProps = { action: AgentAction };

function truncate(value: string): string {
  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

export default function HumanGate({ action }: HumanGateProps) {
  const { t, usd } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signal = useMemo(() => hashAction(action.payload), [action.payload]);
  const preset = fallback ? deviceLegacy({ signal }) : selfieCheckLegacy({ signal });

  useEffect(() => {
    if (!confirmed) return;
    let active = true;
    void fetch("/api/worldid/rp-context").then(async (response) => {
      if (!response.ok) throw new Error(t.gate.contextFailed);
      return (await response.json()) as RpContext;
    }).then((context) => {
      if (!active) return;
      setRpContext(context);
      setOpen(true);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : t.gate.startFailed);
    });
    return () => { active = false; };
  }, [confirmed, t.gate.contextFailed, t.gate.startFailed]);

  async function handleSuccess(result: IDKitResult): Promise<void> {
    // No client-side signal check: the server re-derives the hash from the
    // stored action and is the only authority (a client check cannot be
    // trusted anyway). An earlier version compared `signal_hash` to the raw
    // signal here, which can never match — `signal_hash` is hashSignal(signal)
    // — so it rejected every genuine proof before the server ever saw it.
    const response = await fetch("/api/worldid/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rp_id: rpContext?.rp_id, idkitResponse: result, actionId: action.id }) });
    const payload: unknown = await response.json();
    if (!response.ok) {
      setError(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : t.gate.verifyFailed);
      return;
    }
    const receipt = payload as HumanGateReceipt;
    window.dispatchEvent(new CustomEvent("human-gate:approved", { detail: { actionId: action.id, receipt } }));
    setOpen(false);
  }

  return (
    <div>
      {!confirmed ? (
        <button type="button" className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85" onClick={() => { setError(null); setConfirmed(true); }}>
          {t.gate.approve}
        </button>
      ) : rpContext ? (
        <IDKitInviteCodeRequestWidget open={open} onOpenChange={setOpen} app_id={clientEnv.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`} action={clientEnv.NEXT_PUBLIC_WLD_ACTION} rp_context={rpContext} allow_legacy_proofs={true} environment={clientEnv.NEXT_PUBLIC_WLD_ENV} preset={preset} onSuccess={handleSuccess} onError={() => { console.warn("[World ID] Selfie Check is unavailable; falling back to standard device verification."); setFallback(true); setError(t.gate.selfieUnavailable); }} />
      ) : (
        <p className="rounded-xl border border-border bg-panel-raised px-4 py-3 text-center text-xs text-muted">{t.gate.preparing}</p>
      )}
      {confirmed && <div className="mt-3 rounded-xl border border-border bg-panel p-4 text-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">{t.gate.actionToApprove}</p><p className="mt-2 text-foreground">{action.summary}</p><div className="mt-3 grid gap-2 font-mono text-xs text-muted"><span>{t.gate.cost} {usd(action.costUsd)}</span><span>{t.gate.riskScore} {action.riskScore}/100</span><span>{t.gate.actionHash} {truncate(signal)}</span></div><p className="mt-3 text-xs text-muted">{t.gate.note}</p></div>}
      {error && <p className="mt-3 border border-danger bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
    </div>
  );
}