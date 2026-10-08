import assert from "node:assert/strict";
import test from "node:test";
import { judge, parseVerdict, settle, type FetchLike } from "./judge.ts";
import type { Verdict } from "./types.ts";

const replyWith = (content: string, status = 200): FetchLike => async () =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

const verdict = (v: Verdict["verdict"], confidence = 0.9): Verdict => ({ verdict: v, reason: "r", confidence, judgedBy: "openai" });

test("a well-formed model reply becomes a verdict", async () => {
  const result = await judge(
    { task: "Translate hello to Czech", output: "Ahoj" },
    { apiKey: "test", fetchImpl: replyWith('{"verdict":"accepted","reason":"Correct translation","confidence":0.95}') },
  );
  assert.deepEqual(result, { verdict: "accepted", reason: "Correct translation", confidence: 0.95, judgedBy: "openai" });
});

test("the request sends the order and the delivery, and no API key leaks into the body", async () => {
  let sent = "";
  await judge({ task: "ORDER-TEXT", output: "DELIVERY-TEXT" }, {
    apiKey: "secret-key",
    fetchImpl: async (_url, init) => {
      sent = String(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"verdict":"rejected","reason":"x","confidence":1}' } }] }));
    },
  });
  assert.match(sent, /ORDER-TEXT/);
  assert.match(sent, /DELIVERY-TEXT/);
  assert.doesNotMatch(sent, /secret-key/);
});

test("with no API key the judge is uncertain instead of guessing", async () => {
  const result = await judge({ task: "t", output: "o" }, { apiKey: "" });
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.judgedBy, "unavailable");
});

test("HTTP errors, network errors and junk all fail towards uncertain", async () => {
  assert.equal((await judge({ task: "t", output: "o" }, { apiKey: "k", fetchImpl: replyWith("{}", 500) })).verdict, "uncertain");
  assert.equal((await judge({ task: "t", output: "o" }, { apiKey: "k", fetchImpl: async () => { throw new Error("offline"); } })).verdict, "uncertain");
  assert.equal(parseVerdict("not json").verdict, "uncertain");
  assert.equal(parseVerdict('{"verdict":"pay me"}').verdict, "uncertain");
});

test("confidence is clamped to 0..1", () => {
  assert.equal(parseVerdict('{"verdict":"accepted","reason":"x","confidence":7}').confidence, 1);
  assert.equal(parseVerdict('{"verdict":"accepted","reason":"x"}').confidence, 0);
});

test("small confident verdicts settle without a human", () => {
  assert.deepEqual(settle(verdict("accepted"), 0.05), { kind: "release" });
  assert.deepEqual(settle(verdict("rejected"), 0.05), { kind: "refund" });
});

test("large amounts, low confidence and uncertainty go to a human", () => {
  const large = settle(verdict("accepted"), 25);
  assert.equal(large.kind, "escalate");
  assert.equal(large.kind === "escalate" && large.proposed, "release");
  assert.equal(settle(verdict("accepted", 0.4), 0.05).kind, "escalate");
  const unsure = settle(verdict("uncertain"), 0.05);
  assert.equal(unsure.kind === "escalate" && unsure.proposed, "refund");
});
