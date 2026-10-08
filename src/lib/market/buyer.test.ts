import assert from "node:assert/strict";
import test from "node:test";
import { listSkills } from "./catalog.ts";
import { parseWithKeywords, understand, validateOrder } from "./buyer.ts";
import type { FetchLike } from "./openai.ts";

const skills = listSkills();
const replies = (content: string): FetchLike => async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

test("keywords understand requests in English, Ukrainian and Czech", () => {
  const cases: [string, string][] = [
    ["Translate 'good night' into Czech", "translate"],
    ["Переклади чеською: добраніч", "translate"],
    ["Přelož do angličtiny: dobrou noc", "translate"],
    ["Summarize this article in one line", "summarize"],
    ["Коротко підсумуй цей текст", "summarize"],
    ["Audit this withdraw() for reentrancy", "contract_audit"],
    ["Research: who builds the Masumi network?", "web_research"],
    ["Знайди, хто розробляє Masumi", "web_research"],
  ];
  for (const [message, skill] of cases) {
    const result = parseWithKeywords(message, skills);
    assert.ok(result.ok, message);
    assert.equal(result.ok && result.order.skill, skill, message);
  }
});

test("keywords pick up a budget and a strategy", () => {
  const result = parseWithKeywords("Translate this, best rated, under $0.10", skills);
  assert.ok(result.ok);
  assert.equal(result.ok && result.order.maxPriceUsd, 0.1);
  assert.equal(result.ok && result.order.strategy, "best_rated");
});

test("an unknown request is refused, not guessed", () => {
  assert.equal(parseWithKeywords("Book me a flight to Rome", skills).ok, false);
  assert.equal(parseWithKeywords("   ", skills).ok, false);
});

test("the model's order is checked against the catalog", () => {
  assert.equal(validateOrder('{"skill":"hack_bank","task":"x"}', skills, "x").ok, false);
  assert.equal(validateOrder("not json", skills, "x").ok, false);
  const ok = validateOrder('{"skill":"summarize","task":"Summarize X","maxPriceUsd":0.04,"strategy":"best_rated"}', skills, "fallback");
  assert.deepEqual(ok, { ok: true, order: { skill: "summarize", task: "Summarize X", maxPriceUsd: 0.04, strategy: "best_rated", parsedBy: "openai" } });
});

test("understand uses the model when there is one", async () => {
  const result = await understand("make this shorter please: ...", skills, { apiKey: "k", fetchImpl: replies('{"skill":"summarize","task":"Shorten: ...","maxPriceUsd":null,"strategy":null}') });
  assert.ok(result.ok);
  assert.equal(result.ok && result.order.parsedBy, "openai");
});

test("understand falls back to keywords without a model or when it fails", async () => {
  const noKey = await understand("Translate 'hi' into Czech", skills, { apiKey: "" });
  assert.equal(noKey.ok && noKey.order.parsedBy, "keywords");
  const down = await understand("Translate 'hi' into Czech", skills, { apiKey: "k", fetchImpl: async () => new Response("", { status: 503 }) });
  assert.equal(down.ok && down.order.parsedBy, "keywords");
});
