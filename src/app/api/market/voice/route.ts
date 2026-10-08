import { isLocale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { cs } from "@/i18n/dictionaries/cs";
import { uk } from "@/i18n/dictionaries/uk";
import { isVoicePhrase, speak } from "@/lib/market/voice";

const dictionaries = { en, cs, uk };

/**
 * POST { phrase, locale } → audio/mpeg from ElevenLabs.
 * Only the console's fixed alert phrases can be spoken (no free text), so
 * this public route cannot be used to spend voice credits on anything else.
 * 503 NO_VOICE when no key is set — the console then uses browser speech.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON" } }, { status: 400 });
  }
  const { phrase, locale } = (body ?? {}) as { phrase?: unknown; locale?: unknown };
  if (!isVoicePhrase(phrase)) return Response.json({ error: { code: "INVALID_REQUEST", message: "Unknown phrase" } }, { status: 400 });
  const text = dictionaries[typeof locale === "string" && isLocale(locale) ? locale : "en"].market.voice[phrase];
  const result = await speak(text);
  if (!result.ok) return Response.json({ error: { code: "NO_VOICE", message: result.reason } }, { status: 503 });
  return new Response(result.audio, { headers: { "Content-Type": result.contentType, "Cache-Control": "public, max-age=86400" } });
}
