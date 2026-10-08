import assert from "node:assert/strict";
import test from "node:test";
import { apiActorId, runActor, toSources } from "./apify.ts";
import { SEED_PROVIDERS } from "./catalog.ts";
import type { FetchLike } from "./openai.ts";
import { doWork, researchQuery } from "./worker.ts";

const scout = SEED_PROVIDERS.find((p) => p.id === "apify-scout")!;
const pages = [
  { metadata: { url: "https://masumi.network/", title: "Masumi Network" }, markdown: "Masumi is a payment network for AI agents with escrow and a registry." },
  { searchResult: { url: "https://docs.masumi.network/", title: "Docs", description: "Agent registry and escrow on Cardano." } },
  { metadata: { title: "No URL here" }, markdown: "dropped" },
];
const apifyReplies = (body: unknown, status = 201): FetchLike => async () => new Response(JSON.stringify(body), { status });

test("actor ids accept both user/actor and user~actor", () => {
  assert.equal(apiActorId("apify/rag-web-browser"), "apify~rag-web-browser");
  assert.equal(apiActorId("apify~rag-web-browser"), "apify~rag-web-browser");
});

test("runActor calls the sync endpoint with a Bearer token and the input", async () => {
  let url = ""; let init: RequestInit | undefined;
  const result = await runActor("apify/rag-web-browser", { query: "x" }, { token: "tok", fetchImpl: async (u, i) => { url = u; init = i; return new Response("[]", { status: 201 }); } });
  assert.ok(result.ok);
  assert.match(url, /^https:\/\/api\.apify\.com\/v2\/actors\/apify~rag-web-browser\/run-sync-get-dataset-items\?timeout=\d+/);
  assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.equal(init?.body, '{"query":"x"}');
});

test("runActor reports problems instead of throwing", async () => {
  assert.equal((await runActor("a/b", {}, { token: "" })).ok, false);
  assert.equal((await runActor("not an id", {}, { token: "t" })).ok, false);
  const denied = await runActor("a/b", {}, { token: "t", fetchImpl: apifyReplies({ error: { message: "Not enough credits" } }, 402) });
  assert.equal(denied.ok === false && denied.reason, "Apify returned HTTP 402: Not enough credits");
  assert.equal((await runActor("a/b", {}, { token: "t", fetchImpl: apifyReplies({}, 408) })).ok, false);
  assert.equal((await runActor("a/b", {}, { token: "t", fetchImpl: async () => { throw new Error("offline"); } })).ok, false);
});

test("toSources keeps only pages with a URL, from either item shape", () => {
  const sources = toSources(pages);
  assert.deepEqual(sources.map((s) => s.url), ["https://masumi.network/", "https://docs.masumi.network/"]);
  assert.match(sources[1].excerpt, /registry and escrow/);
});

test("researchQuery strips the request verb", () => {
  assert.equal(researchQuery("Research: who builds Masumi?"), "who builds Masumi?");
  assert.equal(researchQuery("Please find out what x402 is"), "what x402 is");
});

test("without a model, Apify Scout delivers the pages it found, with links", async () => {
  const result = await doWork(scout, "web_research", "Research: what is Masumi?", { apiKey: "", apify: { token: "t", fetchImpl: apifyReplies(pages) } });
  assert.ok(result.ok);
  assert.equal(result.ok && result.via, "apify");
  assert.match(result.ok ? result.output : "", /\[1\] Masumi Network\nhttps:\/\/masumi\.network\//);
});

test("with a model, the summary cites the Apify pages and lists them", async () => {
  let prompt = "";
  const result = await doWork(scout, "web_research", "Research: what is Masumi?", {
    apiKey: "k",
    fetchImpl: async (_u, init) => { prompt = String(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: "Masumi is a payment network for agents [1]." } }] })); },
    apify: { token: "t", fetchImpl: apifyReplies(pages) },
  });
  assert.ok(result.ok);
  assert.match(prompt, /ONLY the numbered SOURCES/);
  assert.match(result.ok ? result.output : "", /\[1\]\.\n\nSources:\n\[1\] Masumi Network — https:\/\/masumi\.network\//);
});

test("Apify failures and empty results surface as provider failures", async () => {
  assert.equal((await doWork(scout, "web_research", "Research: x", { apify: { token: "" } })).ok, false);
  assert.equal((await doWork(scout, "web_research", "Research: x", { apify: { token: "t", fetchImpl: apifyReplies([]) } })).ok, false);
});
