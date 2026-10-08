import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type FunctionDeclaration, type GenerateContentParameters, type GenerateContentResponse, type Part } from "@google/genai";
import { serverEnv } from "@/lib/env";
import type { AgentAction, ChatMessage } from "@/lib/types";
import { PRIMARY_SUBGRAPH_ID } from "../graph/index.ts";
import { graphDeps } from "./deps";
import { runTool, toolDefinitions } from "./tools";

const ADDRESS = /0x[a-fA-F0-9]{40}/;

/**
 * Fetch Graph evidence deterministically BEFORE the first model call.
 *
 * Every model round trip costs seconds (tens of seconds on a congested free
 * tier), and left to itself the model spent ~5 of them probing tools before
 * answering. Pre-fetching turns that into one or two calls, and means the
 * evidence behind a risk decision is gathered by code rather than by whether
 * the model chose to look. Tools stay available for follow-up exploration.
 */
async function prefetchEvidence(messages: ChatMessage[]): Promise<string | undefined> {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  const address = latest?.content.match(ADDRESS)?.[0];
  if (!address) return undefined;
  try {
    const graph = await graphDeps();
    // The ETH price lives in the same Uniswap V3 subgraph; without it the model
    // invented one (valued 1 ETH at $3,000 when the subgraph said $2,467).
    const [assessment, ethPriceUsd] = await Promise.all([
      graph.getWalletActivity(address).then((activity) => graph.assessRisk(activity)),
      graph
        .runGraphQL<{ bundle: { ethPriceUSD: string } | null }>(PRIMARY_SUBGRAPH_ID, '{ bundle(id: "1") { ethPriceUSD } }')
        .then((result) => Number(result.bundle?.ethPriceUSD))
        .catch(() => Number.NaN),
    ]);
    const price = Number.isFinite(ethPriceUsd)
      ? `Live ETH price from the same subgraph (Uniswap V3 bundle): $${ethPriceUsd.toFixed(2)}. Use it for any USD valuation.`
      : "Live ETH price unavailable — do not state a USD value for ETH.";
    return `Live evidence for ${address}, already fetched from The Graph — use it; do not re-fetch:\n${JSON.stringify(assessment)}\n${price}`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return `Live Graph evidence for ${address} is currently UNAVAILABLE (${detail}). Do not retry the Graph tools for this address; say plainly that no live evidence could be obtained.`;
  }
}

const systemPrompt = `You are a cautious on-chain operations copilot.

Use The Graph tools to inspect live evidence before making risk claims. Every risk claim must cite the concrete number and the exact source.subgraphId. Never call a wallet safe or risky without evidence.

You may propose actions, but you must never claim to have executed, sent, settled, or completed an action until a separate human approval receipt exists and the execution endpoint confirms success. Say "proposed" or "awaiting human approval" when appropriate. The propose_action tool only prepares a payload; it never executes it. When an action concerns a wallet, put that address in payload.address. An action exists ONLY if propose_action returned it: to prepare anything you must call propose_action, and you must never say you prepared, proposed or queued something you did not pass to propose_action.

Selfie Check raises the cost of automated and repeated abuse. Do not claim it is sybil-proof or guarantees one person per account.

Never guess prices. For any USD value of ETH, use the live ETH price provided with the evidence; if none is provided, say the USD value is unknown.

Reply in plain text for a chat bubble: no markdown syntax (no asterisks, backticks or headings). Keep it short; use lines starting with "- " for lists. Round USD amounts to cents. Never mention internal tool or function names to the user — say "I've prepared it for your approval", not the name of a tool.`;

const MAX_TURNS = 8;

/*
 * Honesty check, enforced in code rather than hoped for in the prompt.
 * Observed with gemini-flash-lite at LOW thinking: the model replied "I have
 * prepared the transfer for your approval" WITHOUT calling propose_action, so
 * no action existed and nothing could be approved. A claim is checked against
 * what the tools actually did: one corrective turn, then a server-side
 * correction is appended — an unbacked claim never reaches the user as-is.
 */
const CLAIMS_ACTION = /\b(prepared|proposed|queued|created|set up)\b/i;
const HONESTY_NUDGE =
  "System check: your reply says an action was prepared, but propose_action was not called, so no action exists. " +
  "Call propose_action now with the details, or reply again stating plainly that nothing has been prepared.";
const SERVER_CORRECTION = "\n\n[System note: no action was actually prepared — nothing is awaiting approval.]";

/*
 * Latency and capacity, measured 2026-09-11 on the free tier ("Reply: ok"):
 *   gemini-flash-latest,      default thinking  ~20s, intermittent 503 "high demand"
 *   gemini-flash-latest,      thinking LOW      ~4.5s
 *   gemini-flash-lite-latest, thinking LOW      ~0.6s   <- default
 * A tool loop makes several round trips, so per-call latency multiplies; LOW
 * thinking is what makes the console usable. (MINIMAL is rejected by
 * flash-latest, so LOW is the level both models accept.)
 */
const FALLBACK_MODEL = "gemini-flash-latest";
const RETRYABLE = new Set([429, 500, 503]);

/** Retry transient capacity errors, then fall back to the other model once. */
async function generate(ai: GoogleGenAI, request: GenerateContentParameters): Promise<GenerateContentResponse> {
  const models = request.model === FALLBACK_MODEL ? [request.model] : [request.model, FALLBACK_MODEL];
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await ai.models.generateContent({ ...request, model });
      } catch (error) {
        lastError = error;
        if (!(error instanceof ApiError) || !RETRYABLE.has(error.status)) throw error;
        console.warn(`[agent] Gemini ${model} returned ${error.status}; retry ${attempt + 1}/3`);
        await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

const functionDeclarations: FunctionDeclaration[] = toolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.parameters,
}));

function toContents(messages: ChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.content }],
  }));
}

export async function plan(messages: ChatMessage[]): Promise<{ reply: string; action?: AgentAction }> {
  const env = serverEnv();
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const contents = toContents(messages);
  const evidence = await prefetchEvidence(messages);
  const systemInstruction = evidence ? `${systemPrompt}\n\n${evidence}` : systemPrompt;
  // propose_action persists the action server-side; it must also reach the UI,
  // or there is nothing for the human to approve.
  let proposed: AgentAction | undefined;
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const response = await generate(ai, {
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      const reply = response.text?.trim() || "I could not produce a response.";
      if (!proposed && CLAIMS_ACTION.test(reply)) {
        if (!nudged) {
          nudged = true;
          const modelTurn = response.candidates?.[0]?.content;
          if (modelTurn) contents.push(modelTurn);
          contents.push({ role: "user", parts: [{ text: HONESTY_NUDGE }] });
          continue;
        }
        return { reply: reply + SERVER_CORRECTION };
      }
      return { reply, action: proposed };
    }

    // Append the model's turn verbatim. Thinking models attach a thoughtSignature
    // to their parts, and multi-step function calling fails if it is dropped.
    const modelTurn = response.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);

    const results: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      try {
        const output = await runTool(name, call.args ?? {}, messages);
        if (name === "propose_action") proposed = output as AgentAction;
        results.push({ functionResponse: { id: call.id, name, response: { output } } });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown tool error";
        results.push({ functionResponse: { id: call.id, name, response: { error: detail } } });
      }
    }
    contents.push({ role: "user", parts: results });
  }

  throw new Error(`Agent tool loop exceeded its maximum of ${MAX_TURNS} turns`);
}
