import assert from "node:assert/strict";
import test from "node:test";
import { SEED_PROVIDERS } from "./catalog.ts";
import { chat, hasModel, stripJsonFence, type FetchLike } from "./openai.ts";
import { judge } from "./judge.ts";
import { doWork } from "./worker.ts";

const lingo = SEED_PROVIDERS.find((p) => p.id === "lingo-fast")!;

/** Runs `fn` with only the given model keys in the environment, then restores it. */
async function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const keys = ["OPENAI_API_KEY", "OPENAI_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try {
    await fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
const recorder = (content: string, sent: Sent[]): FetchLike => async (url, init) => {
  sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
};

test("with only GEMINI_API_KEY, the worker uses Gemini's OpenAI-compatible endpoint", async () => {
  await withEnv({ GEMINI_API_KEY: "g-key" }, async () => {
    assert.equal(hasModel(), true);
    const sent: Sent[] = [];
    const result = await doWork(lingo, "translate", "Translate 'hello' into Czech", { fetchImpl: recorder(" Ahoj ", sent) });
    assert.deepEqual(result, { ok: true, output: "Ahoj", model: "gemini-flash-lite-latest", via: "openai" });
    assert.equal(sent[0].url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    assert.equal(sent[0].headers.Authorization, "Bearer g-key");
    assert.equal(sent[0].body.model, "gemini-flash-lite-latest");
  });
});

test("GEMINI_MODEL picks the Gemini model", async () => {
  await withEnv({ GEMINI_API_KEY: "g-key", GEMINI_MODEL: "gemini-2.5-flash" }, async () => {
    const sent: Sent[] = [];
    const result = await chat({ system: "s", user: "u", fetchImpl: recorder("ok", sent) });
    assert.equal(result.ok && result.model, "gemini-2.5-flash");
    assert.equal(sent[0].body.model, "gemini-2.5-flash");
  });
});

test("Gemini gets no response_format and its ```json fence is removed, so the judge can read it", async () => {
  await withEnv({ GEMINI_API_KEY: "g-key" }, async () => {
    const sent: Sent[] = [];
    const fenced = '```json\n{"verdict":"accepted","reason":"Correct","confidence":0.9}\n```';
    const verdict = await judge({ task: "Translate 'yes' into Czech", output: "Ano" }, { fetchImpl: recorder(fenced, sent) });
    assert.equal(verdict.verdict, "accepted");
    assert.equal(verdict.confidence, 0.9);
    assert.equal("response_format" in sent[0].body, false);
  });
});

test("OPENAI_API_KEY wins over GEMINI_API_KEY and keeps response_format", async () => {
  await withEnv({ OPENAI_API_KEY: "o-key", GEMINI_API_KEY: "g-key" }, async () => {
    const sent: Sent[] = [];
    await chat({ system: "s", user: "u", json: true, fetchImpl: recorder("{}", sent) });
    assert.equal(sent[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(sent[0].body.model, "gpt-4o-mini");
    assert.deepEqual(sent[0].body.response_format, { type: "json_object" });
  });
});

test("an explicit apiKey never falls back to Gemini", async () => {
  await withEnv({ GEMINI_API_KEY: "g-key" }, async () => {
    assert.equal(hasModel({ apiKey: "" }), false);
    const sent: Sent[] = [];
    await chat({ apiKey: "k", system: "s", user: "u", fetchImpl: recorder("x", sent) });
    assert.equal(sent[0].url, "https://api.openai.com/v1/chat/completions");
  });
});

test("with no key at all there is no model", async () => {
  await withEnv({}, async () => {
    assert.equal(hasModel(), false);
    const result = await chat({ system: "s", user: "u" });
    assert.equal(result.ok, false);
  });
});

test("stripJsonFence leaves plain text alone", () => {
  assert.equal(stripJsonFence('{"a":1}'), '{"a":1}');
  assert.equal(stripJsonFence('```\n{"a":1}\n```'), '{"a":1}');
});
