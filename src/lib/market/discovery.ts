import type { DiscoveryQuery, DiscoveryResult, Provider } from "./types.ts";

/**
 * Discovery: a buyer agent names the skill it needs; we find the provider.
 *
 * Deterministic on purpose. The model never picks who gets paid — it only
 * says which skill it needs. Selection is a filter plus a stable sort, so the
 * same request always picks the same provider and every candidate is shown.
 */
export function discover(providers: readonly Provider[], query: DiscoveryQuery): DiscoveryResult {
  const skill = query.skill.trim().toLowerCase();
  if (!skill) throw new Error("A skill is required for discovery");
  const strategy = query.strategy ?? "cheapest";
  if (query.maxPriceUsd !== undefined && (!Number.isFinite(query.maxPriceUsd) || query.maxPriceUsd < 0)) {
    throw new RangeError("maxPriceUsd must be a non-negative number");
  }

  const withSkill = providers.filter((provider) => provider.skills.includes(skill));
  if (withSkill.length === 0) throw new Error(`No provider offers the skill "${skill}"`);

  const affordable = withSkill.filter((provider) => query.maxPriceUsd === undefined || provider.priceUsd <= query.maxPriceUsd);
  if (affordable.length === 0) {
    const cheapest = Math.min(...withSkill.map((provider) => provider.priceUsd));
    throw new Error(`No "${skill}" provider within $${query.maxPriceUsd}; the cheapest costs $${cheapest}`);
  }

  const qualified = affordable.filter((provider) => query.minRating === undefined || provider.rating >= query.minRating);
  if (qualified.length === 0) throw new Error(`No "${skill}" provider within budget has a rating of ${query.minRating} or more`);

  const candidates = [...qualified].sort((a, b) => {
    const primary = strategy === "cheapest" ? a.priceUsd - b.priceUsd : b.rating - a.rating;
    if (primary !== 0) return primary;
    const secondary = strategy === "cheapest" ? b.rating - a.rating : a.priceUsd - b.priceUsd;
    return secondary !== 0 ? secondary : a.id.localeCompare(b.id);
  });
  const provider = candidates[0];
  const reason = strategy === "cheapest"
    ? `${provider.name} is the cheapest of ${candidates.length} "${skill}" provider(s) within budget ($${provider.priceUsd}, rated ${provider.rating})`
    : `${provider.name} has the best rating of ${candidates.length} "${skill}" provider(s) within budget (${provider.rating}, $${provider.priceUsd})`;
  return { provider, candidates, reason };
}
