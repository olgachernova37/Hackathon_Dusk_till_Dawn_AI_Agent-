import { AUTO_APPROVE_LIMIT_USD, listProviders, listSkills } from "@/lib/market";

/** The provider catalog buyer agents discover from. Demo data — see HACKATHON.md. */
export async function GET(): Promise<Response> {
  return Response.json({
    providers: listProviders(),
    skills: listSkills(),
    autoApproveLimitUsd: AUTO_APPROVE_LIMIT_USD,
    note: "Demo providers with placeholder payout addresses; settlement is simulated.",
  });
}
