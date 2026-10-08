import type { FetchLike } from "./openai.ts";

/**
 * Apify client for provider agents that run an Apify Actor.
 *
 * Uses "run Actor synchronously and get dataset items":
 *   POST https://api.apify.com/v2/actors/<user>~<actor>/run-sync-get-dataset-items
 * with the token as a Bearer header. The token can be an ordinary Apify API
 * token (hackathon credits) or a prepaid token bought over x402
 * (docs.apify.com/integrations/x402) — the call is the same.
 *
 * Never throws: failures come back as `{ ok: false, reason }`.
 */

export interface ApifyOptions {
  token?: string;
  fetchImpl?: FetchLike;
  /** Run timeout in seconds; the sync endpoint itself gives up at 300. */
  timeoutSecs?: number;
}

export type ActorResult = { ok: true; items: unknown[]; actorId: string } | { ok: false; reason: string };

export function hasApify(options: ApifyOptions = {}): boolean {
  return Boolean((options.token ?? process.env.APIFY_TOKEN)?.trim());
}

/** Accepts "user/actor" or "user~actor" and returns the API form. */
export function apiActorId(actorId: string): string {
  return actorId.trim().replace("/", "~");
}

export async function runActor(actorId: string, input: Record<string, unknown>, options: ApifyOptions = {}): Promise<ActorResult> {
  const token = (options.token ?? process.env.APIFY_TOKEN)?.trim();
  if (!token) return { ok: false, reason: "No APIFY_TOKEN is configured" };
  const id = apiActorId(actorId);
  if (!/^[\w.-]+~[\w.-]+$/.test(id)) return { ok: false, reason: `Invalid Actor id: ${actorId}` };
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = Math.min(Math.max(options.timeoutSecs ?? 90, 10), 290);

  let response: Response;
  try {
    response = await fetchImpl(`https://api.apify.com/v2/actors/${id}/run-sync-get-dataset-items?timeout=${timeout}&clean=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch (error) {
    return { ok: false, reason: `Apify could not be reached: ${error instanceof Error ? error.message : "network error"}` };
  }
  if (response.status === 408) return { ok: false, reason: "The Apify run took too long" };
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ? `: ${body.error.message}` : "";
    } catch { /* no JSON body */ }
    return { ok: false, reason: `Apify returned HTTP ${response.status}${detail}` };
  }
  let items: unknown;
  try {
    items = await response.json();
  } catch {
    return { ok: false, reason: "Apify's response was not JSON" };
  }
  if (!Array.isArray(items)) return { ok: false, reason: "Apify returned no dataset items" };
  return { ok: true, items, actorId: id };
}

export interface Source {
  title: string;
  url: string;
  excerpt: string;
}

/** Reads RAG Web Browser-style items; tolerant of other Actors' shapes. */
export function toSources(items: unknown[], limit = 5): Source[] {
  const sources: Source[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const search = (item.searchResult ?? {}) as Record<string, unknown>;
    const url = [metadata.url, search.url, item.url].find((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
    if (!url) continue;
    const title = [metadata.title, search.title, item.title].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? url;
    const body = [item.markdown, item.text, search.description, metadata.description].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? "";
    sources.push({ title: title.trim().slice(0, 200), url, excerpt: body.replace(/\s+/g, " ").trim().slice(0, 1500) });
    if (sources.length >= limit) break;
  }
  return sources;
}
