import { chat, hasModel, type ModelOptions } from "./openai.ts";
import type { DiscoveryStrategy } from "./types.ts";

/**
 * The buyer agent's first job: turn a request in plain words ("translate
 * this into Czech, cheap") into a structured order the marketplace can run.
 *
 * The model only fills in the order. It cannot pick a provider or an amount
 * to pay — discovery does that deterministically, and the skill must be one
 * the catalog actually sells. Without a model, a small keyword matcher in
 * English, Ukrainian and Czech does the same job less flexibly, and the
 * result says which one was used.
 */

export interface Order {
  skill: string;
  /** What the provider must do, kept close to the user's words. */
  task: string;
  maxPriceUsd?: number;
  strategy?: DiscoveryStrategy;
  /** How the request was understood. */
  parsedBy: "openai" | "keywords";
}

export type OrderResult = { ok: true; order: Order } | { ok: false; reason: string };

const KEYWORDS: Record<string, RegExp> = {
  translate: /translat|переклад|перекла|přelož|překlad/i,
  summarize: /summar|tl;?dr|підсум|стисн|коротко|shrn|souhrn/i,
  contract_audit: /audit|reentran|vulnerab|smart contract|контракт|вразлив|аудит|kontrakt|zranitel/i,
  web_research: /research|look up|search the web|find out|find sources|дослідж|знайди|пошукай|з'ясуй|vyhledej|najdi|zjisti/i,
};
const CHEAP = /cheap|cheapest|lowest price|дешев|найдешев|levn/i;
const BEST = /best|top rated|highest rated|найкращ|рейтинг|nejlepš|hodnocen/i;
const PRICE = /(?:under|below|max|до|не більше|maximálně|do)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?/i;

export function parseWithKeywords(message: string, skills: readonly string[]): OrderResult {
  const text = message.trim();
  if (!text) return { ok: false, reason: "The request is empty" };
  const skill = skills.find((s) => KEYWORDS[s]?.test(text));
  if (!skill) return { ok: false, reason: `Could not tell which skill is needed; the catalog sells: ${skills.join(", ")}` };
  const price = text.match(PRICE)?.[1];
  const order: Order = { skill, task: text, parsedBy: "keywords" };
  if (price) order.maxPriceUsd = Number(price.replace(",", "."));
  if (BEST.test(text)) order.strategy = "best_rated";
  else if (CHEAP.test(text)) order.strategy = "cheapest";
  return { ok: true, order };
}

/** Validates the model's JSON against the catalog; anything off is rejected. */
export function validateOrder(raw: string, skills: readonly string[], fallbackTask: string): OrderResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "The buyer agent did not return JSON" };
  }
  if (typeof data !== "object" || data === null) return { ok: false, reason: "The buyer agent returned no order" };
  const record = data as Record<string, unknown>;
  if (typeof record.skill !== "string" || !skills.includes(record.skill)) {
    return { ok: false, reason: `No skill in the catalog matches this request; the catalog sells: ${skills.join(", ")}` };
  }
  const order: Order = {
    skill: record.skill,
    task: typeof record.task === "string" && record.task.trim() ? record.task.trim().slice(0, 4000) : fallbackTask,
    parsedBy: "openai",
  };
  if (typeof record.maxPriceUsd === "number" && Number.isFinite(record.maxPriceUsd) && record.maxPriceUsd >= 0) order.maxPriceUsd = record.maxPriceUsd;
  if (record.strategy === "cheapest" || record.strategy === "best_rated") order.strategy = record.strategy;
  return { ok: true, order };
}

export async function understand(message: string, skills: readonly string[], options: ModelOptions = {}): Promise<OrderResult> {
  const text = message.trim().slice(0, 4000);
  if (!text) return { ok: false, reason: "The request is empty" };
  if (!hasModel(options)) return parseWithKeywords(text, skills);
  const result = await chat({
    ...options,
    json: true,
    system: [
      "You are a buyer agent in a marketplace of AI agents.",
      `Turn the user's request into an order. Allowed skills: ${skills.join(", ")}.`,
      'Reply with JSON only: {"skill": one allowed skill or "none", "task": the job for the provider including all material to work on, "maxPriceUsd": number or null, "strategy": "cheapest" | "best_rated" | null}.',
      "Set maxPriceUsd only when the user states a budget. Never invent material that is not in the request.",
    ].join(" "),
    user: text,
  });
  // A model outage should not block a clear request: fall back to keywords.
  if (!result.ok) return parseWithKeywords(text, skills);
  return validateOrder(result.content, skills, text);
}
