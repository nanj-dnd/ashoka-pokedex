import { BASE_RARITY, RARITY_LADDER, RARITIES, type Rarity } from "./constants";

export interface RarityStanding {
  rarity: Rarity;
  /** Share of active players who have marked this creature seen, 0..1. */
  share: number;
  seenCount: number;
  activePlayers: number;
  /** null once MYTHIC. */
  next: { rarity: Rarity; sightingsNeeded: number } | null;
}

/**
 * Rarity is earned, not assigned: it is a function of how much of the active
 * player base has reported seeing this person. A tier requires both a share
 * threshold and a raw-sightings floor, so a near-empty platform can't hand out
 * LEGENDARY to whoever gets spotted first.
 */
export function standingFor(seenCount: number, activePlayers: number): RarityStanding {
  const share = activePlayers > 0 ? seenCount / activePlayers : 0;

  const tier =
    RARITY_LADDER.find((t) => share >= t.share && seenCount >= t.minSightings)?.rarity ??
    BASE_RARITY;

  // How many more sightings would reach the next tier up, at today's player count.
  const idx = RARITIES.indexOf(tier);
  const nextRarity = RARITIES[idx + 1];
  let next: RarityStanding["next"] = null;

  if (nextRarity) {
    const rule = RARITY_LADDER.find((t) => t.rarity === nextRarity)!;
    const byShare = Math.ceil(rule.share * activePlayers);
    const needed = Math.max(rule.minSightings, byShare) - seenCount;
    next = { rarity: nextRarity, sightingsNeeded: Math.max(1, needed) };
  }

  return { rarity: tier, share, seenCount, activePlayers, next };
}
