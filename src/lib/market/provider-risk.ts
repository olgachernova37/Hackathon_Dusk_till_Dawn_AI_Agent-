import { graphDeps } from "../agent/deps.ts";
import type { ProviderRisk } from "./types.ts";

/**
 * Reads the provider's payout wallet from The Graph (Uniswap V3 mainnet, the
 * same live subgraph the copilot uses) and scores it with the existing,
 * deterministic risk engine. Any failure returns `available: false`, which
 * the funding gate treats as "a human decides" — never as safe.
 */
export async function checkProviderWallet(address: string): Promise<ProviderRisk> {
  try {
    const graph = await graphDeps();
    const activity = await graph.getWalletActivity(address);
    const assessment = graph.assessRisk(activity);
    return {
      address: activity.address,
      available: true,
      score: assessment.score,
      reasons: assessment.reasons,
      txCount: activity.txCount,
      firstSeen: activity.firstSeen,
      totalVolumeUsd: activity.totalVolumeUsd,
      source: activity.source,
    };
  } catch (error) {
    return {
      address: address.toLowerCase(),
      available: false,
      score: null,
      reasons: [`The Graph could not be read: ${error instanceof Error ? error.message : "unknown error"}`],
    };
  }
}
