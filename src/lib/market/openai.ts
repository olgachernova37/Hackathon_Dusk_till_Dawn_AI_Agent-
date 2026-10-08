/**
 * Minimal Chat Completions client shared by the marketplace's three model
 * roles: the buyer agent (reads a request), provider agents (do the work) and
 * the judge (checks the work). Plain fetch, no SDK, so tests can inject a
 * fake transport.
 *
 * Two backends, both speaking the OpenAI Chat Completions format:
 *   - OpenAI, when OPENAI_API_KEY is set (or an apiKey is passed explicitly);
 *   - otherwise Google Gemini through its OpenAI-compatible endpoint, when
 *     GEMINI_API_KEY is set. An explicit apiKey (as tests pass) always means
 *     OpenAI, never Gemini.
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

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

type Backend = { provider: "openai" | "gemini"; url: string; apiKey: string; model: string };

function pickBackend(options: ModelOptions): Backend | null {
  // An explicitly passed key (tests) always means OpenAI, even an empty one.
  if (options.apiKey !== undefined) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) return null;
    return { provider: "openai", url: OPENAI_URL, apiKey, model: options.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" };
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return { provider: "openai", url: OPENAI_URL, apiKey: openaiKey, model: options.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" };
  }
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return { provider: "gemini", url: GEMINI_URL, apiKey: geminiKey, model: options.model?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest" };
  }
  return null;
}

export function hasModel(options: ModelOptions = {}): boolean {
  return pickBackend(options) !== null;
}

/** Gemini may wrap JSON in a ```json … ``` fence; take what is inside. */
export function stripJsonFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1].trim() : text;
}

export async function chat(request: ChatRequest): Promise<ChatResult> {
  const backend = pickBackend(request);
  if (!backend) return { ok: false, reason: "No model key is configured (set GEMINI_API_KEY or OPENAI_API_KEY)" };
  const fetchImpl = request.fetchImpl ?? fetch;
  const isGemini = backend.provider === "gemini";

  let response: Response;
  try {
    response = await fetchImpl(backend.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${backend.apiKey}` },
      body: JSON.stringify({
        model: backend.model,
        temperature: request.temperature ?? 0,
        // Gemini's compatibility layer is not relied on for response_format;
        // the prompts already ask for JSON and the fence is stripped below.
        ...(request.json && !isGemini && { response_format: { type: "json_object" } }),
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
  return { ok: true, content: isGemini ? stripJsonFence(content) : content, model: backend.model };
}
