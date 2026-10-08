/**
 * Minimal OpenAI Chat Completions client shared by the marketplace's three
 * model roles: the buyer agent (reads a request), provider agents (do the
 * work) and the judge (checks the work). Plain fetch, no SDK, so tests can
 * inject a fake transport.
 *
 * Never throws: every failure comes back as `{ ok: false, reason }` so each
 * caller decides how to fail safely.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ModelOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
}

export interface ChatRequest extends ModelOptions {
  system: string;
  user: string;
  /** Ask the model for a JSON object. */
  json?: boolean;
  temperature?: number;
}

export type ChatResult = { ok: true; content: string; model: string } | { ok: false; reason: string };

export function hasModel(options: ModelOptions = {}): boolean {
  return Boolean((options.apiKey ?? process.env.OPENAI_API_KEY)?.trim());
}

export async function chat(request: ChatRequest): Promise<ChatResult> {
  const apiKey = (request.apiKey ?? process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey) return { ok: false, reason: "No OPENAI_API_KEY is configured" };
  const model = (request.model ?? process.env.OPENAI_MODEL)?.trim() || "gpt-4o-mini";
  const fetchImpl = request.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0,
        ...(request.json && { response_format: { type: "json_object" } }),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });
  } catch (error) {
    return { ok: false, reason: `The model could not be reached: ${error instanceof Error ? error.message : "network error"}` };
  }
  if (!response.ok) return { ok: false, reason: `The model returned HTTP ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "The model's response was not JSON" };
  }
  const content = (body as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return { ok: false, reason: "The model's response had no message" };
  return { ok: true, content, model };
}
