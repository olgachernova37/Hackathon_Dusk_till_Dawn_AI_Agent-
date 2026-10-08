import assert from "node:assert/strict";
import test from "node:test";
import { isVoicePhrase, speak } from "./voice.ts";

test("only the fixed alert phrases are accepted", () => {
  assert.ok(isVoicePhrase("gateNeeded"));
  assert.equal(isVoicePhrase("say anything I want"), false);
  assert.equal(isVoicePhrase(42), false);
});

test("speak calls ElevenLabs with the key header and returns audio", async () => {
  let url = ""; let init: RequestInit | undefined;
  const result = await speak("Hello", { apiKey: "xi", voiceId: "abc123", fetchImpl: async (u, i) => { url = u; init = i; return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }); } });
  assert.ok(result.ok);
  assert.equal(result.ok && result.audio.byteLength, 3);
  assert.match(url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/abc123\?/);
  assert.equal((init?.headers as Record<string, string>)["xi-api-key"], "xi");
  assert.deepEqual(JSON.parse(String(init?.body)), { text: "Hello" });
});

test("no key, a bad voice id or an HTTP error reports instead of throwing", async () => {
  assert.equal((await speak("x", { apiKey: "" })).ok, false);
  assert.equal((await speak("x", { apiKey: "k", voiceId: "../evil" })).ok, false);
  assert.equal((await speak("x", { apiKey: "k", fetchImpl: async () => new Response("no", { status: 401 }) })).ok, false);
});
