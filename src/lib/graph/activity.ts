import type { WalletActivity } from "@/lib/types";
import { runGraphQL } from "./client.ts";

export const PRIMARY_SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";
const MAX_SWAPS = 1000;
const excludedRouters = new Set([
  "0xe592427a0aece92de3edee1f18e0157c05861564",
  "0xc36442b4a4522e871399cd717abdd847ab11fe88",
]);

type Swap = { timestamp: string; amountUSD: string; recipient: string; token0?: { symbol?: string }; token1?: { symbol?: string } };
type SwapData = { swaps: Swap[] };

const swapsQuery = `query WalletSwaps($address: Bytes!) {
  swaps(first: 1000, orderBy: timestamp, orderDirection: desc, where: { origin: $address }) {
    timestamp amountUSD recipient token0 { symbol } token1 { symbol }
  }
}`;
const firstSwapQuery = `query FirstWalletSwap($address: Bytes!) {
  swaps(first: 1, orderBy: timestamp, orderDirection: asc, where: { origin: $address }) { timestamp }
}`;

function decimal(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid swap amountUSD: ${value}`);
  return parsed;
}

export async function getWalletActivity(address: string): Promise<WalletActivity> {
  const normalized = address.toLowerCase();
  const [recent, first] = await Promise.all([
    runGraphQL<SwapData>(PRIMARY_SUBGRAPH_ID, swapsQuery, { address: normalized }),
    runGraphQL<SwapData>(PRIMARY_SUBGRAPH_ID, firstSwapQuery, { address: normalized }),
  ]);
  const swaps = recent.swaps;
  const counterparties = new Map<string, number>();
  let totalVolumeUsd = 0;
  for (const swap of swaps) {
    totalVolumeUsd += decimal(swap.amountUSD);
    const counterparty = swap.recipient.toLowerCase();
    if (!excludedRouters.has(counterparty)) counterparties.set(counterparty, (counterparties.get(counterparty) ?? 0) + 1);
  }
  const topCounterparties = [...counterparties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([counterparty, count]) => ({ address: counterparty, count }));
  const firstTimestamp = first.swaps[0]?.timestamp;
  return {
    address: normalized,
    firstSeen: firstTimestamp ? Number(firstTimestamp) * 1000 : null,
    txCount: swaps.length,
    uniqueCounterparties: counterparties.size,
    totalVolumeUsd,
    topCounterparties,
    source: { subgraphId: PRIMARY_SUBGRAPH_ID, queriedAt: Date.now() },
  };
}

export { MAX_SWAPS };