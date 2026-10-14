import type { DexConfig, RarityTier } from "./dexConfig";

export interface RarityStanding {
  rarity: string;
  /** Colour for this tier, so callers never re-look it up. */
  rarityColor: string;
  /** Share of this dex's members who have marked this entry seen, 0..1. */
  share: number;
  seenCount: number;
  activePlayers: number;
  /** null once at the top of the ladder. */
  next: { rarity: string; sightingsNeeded: number } | null;
}

/**
 * Rarity is earned, not assigned: it is a function of how much of a dex's
 * membership has reported seeing this entry. A tier requires both a share
 * threshold and a raw-sightings floor, so a near-empty dex can't hand out its
 * top tier to whoever gets spotted first.
 *
 * The ladder itself is per-dex config, so "LEGENDARY at 50%" is this dex's
 * opinion, not the engine's.
 */
export function standingFor(
  seenCount: number,
  activePlayers: number,
  config: DexConfig,
): RarityStanding {
  // normaliseConfig guarantees at least two tiers, sorted ascending, with the
  // first reachable by everyone.
  const ladder: RarityTier[] = config.rarities;
  const share = activePlayers > 0 ? seenCount / activePlayers : 0;

  // Walk down from the top: the first tier whose BOTH conditions are met wins.
  let index = 0;
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (share >= ladder[i].share && seenCount >= ladder[i].minSightings) {
      index = i;
      break;
    }
  }

  const tier = ladder[index];
  const upper = ladder[index + 1];

  let next: RarityStanding["next"] = null;
  if (upper) {
    const byShare = Math.ceil(upper.share * activePlayers);
    const needed = Math.max(upper.minSightings, byShare) - seenCount;
    next = { rarity: upper.label, sightingsNeeded: Math.max(1, needed) };
  }

  return {
    rarity: tier.label,
    rarityColor: tier.color,
    share,
    seenCount,
    activePlayers,
    next,
  };
}

/** Where a tier sits on the ladder; -1 if the label is unknown to this dex. */
export function rarityRank(label: string | null, config: DexConfig): number {
  if (!label) return -1;
  return config.rarities.findIndex((r) => r.label === label);
}
