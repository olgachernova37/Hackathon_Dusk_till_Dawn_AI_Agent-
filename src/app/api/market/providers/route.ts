import { AUTO_APPROVE_LIMIT_USD, NETWORKS, graphGateMode, listProviders, listSkills, settlementRail, spendCaps, spentToday } from "@/lib/market";

/**
 * The provider catalog buyer agents discover from (demo data — see
 * HACKATHON.md), plus how money moves right now: the settlement mode, the
 * escrow wallet and the hard spending caps, so the console can label it.
 */
export async function GET(): Promise<Response> {
  const rail = settlementRail();
  return Response.json({
    providers: listProviders(),
    skills: listSkills(),
    autoApproveLimitUsd: AUTO_APPROVE_LIMIT_USD,
    settlement: {
      mode: rail.mode,
      network: rail.mode === "simulated" ? null : NETWORKS[rail.mode].label,
      buyerAddress: rail.buyerAddress,
      escrowAddress: rail.escrowAddress,
      escrowUrl: rail.explorer && rail.escrowAddress ? `${rail.explorer}/address/${rail.escrowAddress}` : null,
    },
    caps: { ...spendCaps(), spentTodayUsd: await spentToday() },
    graphGate: graphGateMode(),
  });
}
