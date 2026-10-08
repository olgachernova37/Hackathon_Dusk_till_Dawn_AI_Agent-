import type { Provider } from "./types.ts";

/**
 * Seed catalog of provider agents.
 *
 * These are DEMO providers: their names, prices and ratings are invented for
 * the hackathon and their payout addresses are placeholders that no one
 * controls. A real deployment would read this list from an agent registry.
 */
export const SEED_PROVIDERS: readonly Provider[] = Object.freeze([
  {
    id: "lingo-fast",
    name: "Lingo Fast",
    skills: ["translate"],
    priceUsd: 0.02,
    payTo: "0x1111111111111111111111111111111111111111",
    rating: 4.2,
    jobs: 310,
  },
  {
    id: "lingo-pro",
    name: "Lingo Pro",
    skills: ["translate", "summarize"],
    priceUsd: 0.05,
    payTo: "0x2222222222222222222222222222222222222222",
    rating: 4.9,
    jobs: 128,
  },
  {
    id: "brief-bot",
    name: "Brief Bot",
    skills: ["summarize"],
    priceUsd: 0.03,
    payTo: "0x3333333333333333333333333333333333333333",
    rating: 4.5,
    jobs: 77,
  },
  {
    id: "audit-hawk",
    name: "Audit Hawk",
    skills: ["contract_audit"],
    priceUsd: 25,
    payTo: "0x4444444444444444444444444444444444444444",
    rating: 4.7,
    jobs: 19,
  },
  {
    // The one provider that is an external service: it runs an Apify Actor.
    id: "apify-scout",
    name: "Apify Scout",
    skills: ["web_research"],
    priceUsd: 0.1,
    payTo: "0x5555555555555555555555555555555555555555",
    rating: 4.6,
    jobs: 54,
  },
]);

/**
 * Optional payout-address overrides, so a demo can point providers at wallets
 * the team controls (and that have real on-chain history for The Graph to
 * read): MARKET_PROVIDER_ADDRESSES='{"lingo-fast":"0x…"}'. Invalid entries are
 * ignored with a warning; the placeholders stay in place.
 */
function addressOverrides(): Record<string, string> {
  const raw = process.env.MARKET_PROVIDER_ADDRESSES?.trim();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    const valid: Record<string, string> = {};
    for (const [id, address] of Object.entries(parsed)) {
      if (typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address)) valid[id] = address;
      else console.warn(`[market] ignoring invalid address for provider "${id}"`);
    }
    return valid;
  } catch {
    console.warn("[market] MARKET_PROVIDER_ADDRESSES is not valid JSON; using placeholder addresses");
    return {};
  }
}

export function listProviders(): Provider[] {
  const overrides = addressOverrides();
  return SEED_PROVIDERS.map((provider) => ({ ...provider, skills: [...provider.skills], payTo: overrides[provider.id] ?? provider.payTo }));
}

export function getProvider(id: string): Provider | undefined {
  return listProviders().find((provider) => provider.id === id);
}

export function listSkills(): string[] {
  return [...new Set(SEED_PROVIDERS.flatMap((provider) => provider.skills))].sort();
}
