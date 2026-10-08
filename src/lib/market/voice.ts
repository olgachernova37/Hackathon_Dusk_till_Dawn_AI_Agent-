import type { FetchLike } from "./openai.ts";

/**
 * ElevenLabs text-to-speech for the deal console's spoken alerts.
 * Never throws; without ELEVENLABS_API_KEY it reports `ok: false` and the
 * console falls back to the browser's built-in speech.
 */

export const VOICE_PHRASES = ["gateNeeded", "funded", "judgeAccepted", "judgeRejected", "judgeUnsure", "paid", "refunded"] as const;
export type VoicePhrase = (typeof VOICE_PHRASES)[number];

export function isVoicePhrase(value: unknown): value is VoicePhrase {
  return typeof value === "string" && (VOICE_PHRASES as readonly string[]).includes(value);
}

export interface VoiceOptions {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  fetchImpl?: FetchLike;
}

export type SpeechResult = { ok: true; audio: ArrayBuffer; contentType: string } | { ok: false; reason: string };

export function hasVoice(options: VoiceOptions = {}): boolean {
  return Boolean((options.apiKey ?? process.env.ELEVENLABS_API_KEY)?.trim());
}

export async function speak(text: string, options: VoiceOptions = {}): Promise<SpeechResult> {
  const apiKey = (options.apiKey ?? process.env.ELEVENLABS_API_KEY)?.trim();
  if (!apiKey) return { ok: false, reason: "No ELEVENLABS_API_KEY is configured" };
  const voiceId = (options.voiceId ?? process.env.ELEVENLABS_VOICE_ID)?.trim() || "JBFqnCBsd6RMkjVDRZzb";
  if (!/^[A-Za-z0-9]+$/.test(voiceId)) return { ok: false, reason: "Invalid ELEVENLABS_VOICE_ID" };
  const modelId = (options.modelId ?? process.env.ELEVENLABS_MODEL)?.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey, Accept: "audio/mpeg" },
      // multilingual by default, so Czech and Ukrainian phrases are spoken properly
      body: JSON.stringify({ text: text.slice(0, 300), ...(modelId && { model_id: modelId }) }),
    });
  } catch (error) {
    return { ok: false, reason: `ElevenLabs could not be reached: ${error instanceof Error ? error.message : "network error"}` };
  }
  if (!response.ok) return { ok: false, reason: `ElevenLabs returned HTTP ${response.status}` };
  const audio = await response.arrayBuffer();
  if (audio.byteLength === 0) return { ok: false, reason: "ElevenLabs returned no audio" };
  return { ok: true, audio, contentType: response.headers.get("content-type") || "audio/mpeg" };
}
