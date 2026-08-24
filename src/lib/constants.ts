/**
 * The game vocabulary for the Ashoka Pokedex.
 * Everything here is display-facing — edit freely to re-flavour the dex.
 */

/* -------------------------------------------------------------------------- */
/*  Rarity — EARNED, never assigned                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rarity is not a property an admin types in. Everyone enters the dex as
 * UNCOMMON and climbs as more of the campus reports seeing them, measured as a
 * share of everyone actively playing. So "rarity" here means notoriety: how
 * widely known you are, not how scarce.
 */
export const RARITIES = ["UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;

export type Rarity = (typeof RARITIES)[number];

export const BASE_RARITY: Rarity = "UNCOMMON";

/**
 * A tier needs BOTH a share of the active player base and a floor of raw
 * sightings — otherwise the first two people on the platform crown each other
 * MYTHIC on day one.
 */
export const RARITY_LADDER: { rarity: Rarity; share: number; minSightings: number }[] = [
  { rarity: "MYTHIC", share: 0.75, minSightings: 12 },
  { rarity: "LEGENDARY", share: 0.5, minSightings: 8 },
  { rarity: "EPIC", share: 0.3, minSightings: 5 },
  { rarity: "RARE", share: 0.15, minSightings: 3 },
  { rarity: "UNCOMMON", share: 0, minSightings: 0 },
];

export const RARITY_STYLE: Record<Rarity, { ink: string; glow: string; label: string }> = {
  UNCOMMON: { ink: "#8b9bb4", glow: "rgba(139,155,180,0.45)", label: "UNCOMMON" },
  RARE: { ink: "#38bdf8", glow: "rgba(56,189,248,0.5)", label: "RARE" },
  EPIC: { ink: "#c084fc", glow: "rgba(192,132,252,0.55)", label: "EPIC" },
  LEGENDARY: { ink: "#fbbf24", glow: "rgba(251,191,36,0.6)", label: "LEGENDARY" },
  MYTHIC: { ink: "#fb7185", glow: "rgba(251,113,133,0.65)", label: "MYTHIC" },
};

/** Shown on the detail card so the ladder isn't a mystery. */
export const RARITY_FLAVOUR: Record<Rarity, string> = {
  UNCOMMON: "Barely on the radar. Someone knows you exist.",
  RARE: "Word is getting around.",
  EPIC: "A third of campus can place your face.",
  LEGENDARY: "Half of Ashoka has seen you in the wild.",
  MYTHIC: "Functionally a campus landmark.",
};

/* -------------------------------------------------------------------------- */
/*  Types — personality, not geography                                         */
/* -------------------------------------------------------------------------- */

/**
 * Where someone hangs out is the HABITAT. Type is what they *are* — archetypes,
 * not slang. The joke should be in the description, not the label.
 */
export const TYPES = [
  "ORATOR",
  "RECLUSE",
  "ATHLETE",
  "ROMANTIC",
  "SCHOLAR",
  "VISIONARY",
  "PROTAGONIST",
  "BYSTANDER",
  "CHARMER",
  "NOCTURNAL",
  "CAFFEINATED",
  "MENACE",
  "OVERCOMMITTED",
  "FREELOADER",
  "COMBUSTIBLE",
  "NATURALIST",
] as const;

export type CreatureType = (typeof TYPES)[number];

export const TYPE_COLOR: Record<CreatureType, string> = {
  ORATOR: "#f59e0b",
  RECLUSE: "#94a3b8",
  ATHLETE: "#ef4444",
  ROMANTIC: "#fb7185",
  SCHOLAR: "#7c9cff",
  VISIONARY: "#e879f9",
  PROTAGONIST: "#fbbf24",
  BYSTANDER: "#64748b",
  CHARMER: "#f472b6",
  NOCTURNAL: "#6366f1",
  CAFFEINATED: "#a16207",
  MENACE: "#dc2626",
  OVERCOMMITTED: "#2dd4bf",
  FREELOADER: "#84cc16",
  COMBUSTIBLE: "#fb923c",
  NATURALIST: "#22c55e",
};

/** One-liners shown while picking. This is where the humour lives. */
export const TYPE_HINT: Record<CreatureType, string> = {
  ORATOR: "Has never once finished a story.",
  RECLUSE: "Last confirmed sighting was in March.",
  ATHLETE: "Treats the rest day as theoretical.",
  ROMANTIC: "It is, allegedly, complicated.",
  SCHOLAR: "Ruins the curve and apologises for it.",
  VISIONARY: "The plan is not going to work.",
  PROTAGONIST: "Walks like there is a soundtrack.",
  BYSTANDER: "Same four sentences, every time.",
  CHARMER: "Talks their way out of everything.",
  NOCTURNAL: "Comes alive at 3am, useless by noon.",
  CAFFEINATED: "Vibrating slightly, at all times.",
  MENACE: "Removed from at least one group chat.",
  OVERCOMMITTED: "In nine societies, present at none.",
  FREELOADER: "Added their name to the slides on Sunday night.",
  COMBUSTIBLE: "One badly worded email from detonating.",
  NATURALIST: "Astonishingly, goes outside.",
};

/* -------------------------------------------------------------------------- */
/*  Habitat — where they're actually found                                     */
/* -------------------------------------------------------------------------- */

const AC = Array.from({ length: 7 }, (_, i) => `AC-0${i + 1}`);
const RH = Array.from({ length: 7 }, (_, i) => `RH-0${i + 1}`);

export const HABITATS = [
  ...AC,
  ...RH,
  "THE MESS",
  "THE DHABA",
  "THE LIBRARY",
  "SPORTS BLOCK",
  "AMPHITHEATRE",
  "THE LAWN",
  "CAFETERIA",
  "ROAMING",
] as const;

/* -------------------------------------------------------------------------- */
/*  Batch                                                                      */
/* -------------------------------------------------------------------------- */

export const BATCHES = ["UG2026", "UG2025", "UG2024", "UG2023"] as const;

/**
 * Which year of college a batch is currently in. Derived from the date rather
 * than hardcoded, so the dex doesn't quietly go stale every July.
 */
export function collegeYear(batch: string, now = new Date()): string {
  const entry = Number(/(\d{4})/.exec(batch)?.[1]);
  if (!Number.isFinite(entry)) return "";
  // The academic year rolls over in July.
  const academicStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const year = academicStart - entry + 1;
  const ordinal = ["1ST", "2ND", "3RD", "4TH"][year - 1];
  if (year <= 0) return "INCOMING";
  return ordinal ? `${ordinal} YEAR` : "ALUM";
}

/** "UG26 · 2ND YEAR" */
export function batchLabel(batch: string, now = new Date()): string {
  if (!batch) return "";
  const short = batch.replace(/^UG20/, "UG");
  const year = collegeYear(batch, now);
  return year ? `${short} · ${year}` : short;
}

/* -------------------------------------------------------------------------- */
/*  Stats                                                                      */
/* -------------------------------------------------------------------------- */

export const STATS = [
  { key: "presence", label: "PRESENCE" },
  { key: "charm", label: "CHARM" },
  { key: "volume", label: "VOLUME" },
  { key: "volatility", label: "VOLATILITY" },
  { key: "discipline", label: "DISCIPLINE" },
  { key: "burnout", label: "BURNOUT" },
] as const;

/** Shown under the sliders so the axes aren't ambiguous. */
export const STAT_HINT: Record<(typeof STATS)[number]["key"], string> = {
  presence: "How much room they take up.",
  charm: "How easily they get away with it.",
  volume: "Words per minute, unprompted.",
  volatility: "Distance from calm to incident.",
  discipline: "Whether the work actually gets done.",
  burnout: "How close to the edge they are.",
};

export type StatKey = (typeof STATS)[number]["key"];

/** Sprite resolution. Small on purpose — it is the whole aesthetic. */
export const SPRITE_SIZE = 96;
/** Long edge of the stored full-colour photo. */
export const PHOTO_SIZE = 720;
