"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { ChatMessage } from "@/lib/types";

type ChatPaneProps = { messages: ChatMessage[]; busy: boolean; onSubmit: (content: string) => Promise<void> };

export default function ChatPane({ messages, busy, onSubmit }: ChatPaneProps) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const roleLabels: Record<ChatMessage["role"], string> = { user: t.chat.roleUser, assistant: t.chat.roleAssistant, system: t.chat.roleSystem };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = content.trim();
    if (!next || busy) return;
    setContent("");
    await onSubmit(next);
  }

  return (
    <section className="flex min-h-[620px] flex-col bg-panel p-5 sm:p-6" aria-labelledby="chat-heading">
      <div className="flex items-center justify-between border-b border-border pb-4"><h2 id="chat-heading" className="text-sm font-semibold text-foreground">{t.chat.heading}</h2><span className={`text-xs ${busy ? "text-warn" : "text-ok"}`}>{busy ? t.chat.thinking : t.chat.ready}</span></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-5">
        {messages.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted">{t.chat.empty}</p>}
        {messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-5" : "mr-3"}><div className={`border p-3 text-sm leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] ${message.role === "user" ? "border-brand/40 bg-brand/10 text-foreground" : message.role === "system" ? "border-danger/50 bg-danger/10 text-danger" : "border-border bg-panel-raised text-muted"}`}><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-brand">{roleLabels[message.role] ?? message.role}</p>{message.content}</div></div>)}
        {busy && <div className="mr-3 rounded-xl border border-warn/50 bg-warn/10 p-3 text-xs text-warn">{t.chat.planning}</div>}
      </div>
      <form onSubmit={submit} className="border-t border-border pt-4"><label htmlFor="agent-message" className="sr-only">{t.chat.inputLabel}</label><div className="flex gap-2"><input id="agent-message" value={content} onChange={(event) => setContent(event.target.value)} placeholder={t.chat.placeholder} className="min-w-0 flex-1 rounded-xl border border-border bg-panel-raised px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted transition-colors focus:border-brand" disabled={busy} /><button type="submit" disabled={busy || !content.trim()} className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50">{t.chat.send}</button></div></form>
    </section>
  );
}
