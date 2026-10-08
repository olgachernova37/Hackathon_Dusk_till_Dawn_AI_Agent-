import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

// The shared env validator covers every server module. The smoke command only
// exercises The Graph, so fill unrelated absent fields with inert placeholders.
if (!process.env.WLD_RP_PRIVATE_KEY) process.env.WLD_RP_PRIVATE_KEY = "smoke-placeholder";
if (!process.env.WLD_API_KEY) process.env.WLD_API_KEY = "smoke-placeholder";
if (!process.env.BAZANTIC_API_KEY) process.env.BAZANTIC_API_KEY = "smoke-placeholder";
try { new URL(process.env.BAZANTIC_GATEWAY_URL ?? ""); } catch { process.env.BAZANTIC_GATEWAY_URL = "https://smoke.invalid"; }
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "smoke-placeholder";

const address = process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`Invalid Ethereum address: ${address}`);
const { getWalletActivity } = await import("../src/lib/graph/activity.ts");
const { assessRisk } = await import("../src/lib/graph/risk.ts");
const assessment = assessRisk(await getWalletActivity(address));
console.log(JSON.stringify({ address, score: assessment.score, reasons: assessment.reasons, source: assessment.evidence.source, txCount: assessment.evidence.txCount, volumeUsd: assessment.evidence.totalVolumeUsd }, null, 2));