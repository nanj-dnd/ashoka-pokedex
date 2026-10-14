/**
 * Per-dex configuration — the "constraints" an owner sets.
 *
 * Everything in here used to be hardcoded in constants.ts, which is what made
 * this one university's dex rather than a thing anyone can run. It now lives as
 * validated JSON on the dex row, so two dexes on the same deployment can share
 * nothing but the engine.
 *
 * Rules of the road:
 *  - NEVER trust a stored config. It was written by a user, so every read path
 *    goes through `normaliseConfig`, which clamps, de-duplicates and fills gaps.
 *    A malformed row must degrade to a working dex, never crash one.
 *  - Rarity is still earned, not assigned — owners tune the ladder, not the
 *    outcome. See lib/rarity.ts.
 */

export interface TypeDef {
  label: string;
  color: string;
  hint: string;
}

export interface StatDef {
  /** Stable key used in stored creature stats. Never shown. */
  key: string;
  label: string;
  hint: string;
}

export interface RarityTier {
  label: string;
  color: string;
  /** Share of members who must have marked a sighting, 0..1. */
  share: number;
  /** Absolute floor, so a tiny dex can't hand out top tiers on day one. */
  minSightings: number;
}

export interface DexConfig {
  /** Shown above the grid; "CREATURES" for a people dex, "PLANTS", whatever. */
  nounPlural: string;
  nounSingular: string;
  types: TypeDef[];
  habitats: string[];
  /** Exactly SLOT_COUNT entries; the card is drawn for six bars. */
  stats: StatDef[];
  /** Ordered weakest → strongest. First tier is where everyone starts. */
  rarities: RarityTier[];
  /** Distinct admins needed to approve an entry. 1–5. */
  requiredApprovals: number;
  /** Can ordinary members nominate, or is capture admin-only? */
  membersCanNominate: boolean;
  /** Optional free-text field label, e.g. "BATCH" or "TEAM". Empty hides it. */
  cohortLabel: string;
  cohortOptions: string[];
}

export const STAT_COUNT = 6;
export const MAX_TYPES = 24;
export const MAX_HABITATS = 40;
export const MIN_RARITIES = 2;
export const MAX_RARITIES = 6;

const FALLBACK_COLORS = [
  "#f59e0b", "#94a3b8", "#ef4444", "#fb7185", "#7c9cff", "#e879f9",
  "#fbbf24", "#64748b", "#f472b6", "#6366f1", "#a16207", "#dc2626",
  "#2dd4bf", "#84cc16", "#fb923c", "#22c55e", "#38bdf8", "#c084fc",
];

/* -------------------------------------------------------------------------- */
/*  Presets                                                                    */
/* -------------------------------------------------------------------------- */

/** The original Ashoka vocabulary, kept as one preset among several. */
export const CAMPUS_PRESET: DexConfig = {
  nounPlural: "CREATURES",
  nounSingular: "CREATURE",
  types: [
    { label: "ORATOR", color: "#f59e0b", hint: "Has never once finished a story." },
    { label: "RECLUSE", color: "#94a3b8", hint: "Last confirmed sighting was in March." },
    { label: "ATHLETE", color: "#ef4444", hint: "Treats the rest day as theoretical." },
    { label: "ROMANTIC", color: "#fb7185", hint: "It is, allegedly, complicated." },
    { label: "SCHOLAR", color: "#7c9cff", hint: "Ruins the curve and apologises for it." },
    { label: "VISIONARY", color: "#e879f9", hint: "The plan is not going to work." },
    { label: "PROTAGONIST", color: "#fbbf24", hint: "Walks like there is a soundtrack." },
    { label: "BYSTANDER", color: "#64748b", hint: "Same four sentences, every time." },
    { label: "CHARMER", color: "#f472b6", hint: "Talks their way out of everything." },
    { label: "NOCTURNAL", color: "#6366f1", hint: "Comes alive at 3am, useless by noon." },
    { label: "CAFFEINATED", color: "#a16207", hint: "Vibrating slightly, at all times." },
    { label: "MENACE", color: "#dc2626", hint: "Removed from at least one group chat." },
    { label: "OVERCOMMITTED", color: "#2dd4bf", hint: "In nine societies, present at none." },
    { label: "FREELOADER", color: "#84cc16", hint: "Added their name to the slides on Sunday night." },
    { label: "COMBUSTIBLE", color: "#fb923c", hint: "One badly worded email from detonating." },
    { label: "NATURALIST", color: "#22c55e", hint: "Astonishingly, goes outside." },
  ],
  habitats: [
    "AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07",
    "RH-01", "RH-02", "RH-03", "RH-04", "RH-05", "RH-06", "RH-07",
    "THE MESS", "THE DHABA", "THE LIBRARY", "SPORTS BLOCK",
    "AMPHITHEATRE", "THE LAWN", "CAFETERIA", "ROAMING",
  ],
  stats: [
    { key: "presence", label: "PRESENCE", hint: "How much room they take up." },
    { key: "charm", label: "CHARM", hint: "How easily they get away with it." },
    { key: "volume", label: "VOLUME", hint: "Words per minute, unprompted." },
    { key: "volatility", label: "VOLATILITY", hint: "Distance from calm to incident." },
    { key: "discipline", label: "DISCIPLINE", hint: "Whether the work actually gets done." },
    { key: "burnout", label: "BURNOUT", hint: "How close to the edge they are." },
  ],
  rarities: [
    { label: "UNCOMMON", color: "#8b9bb4", share: 0, minSightings: 0 },
    { label: "RARE", color: "#38bdf8", share: 0.15, minSightings: 3 },
    { label: "EPIC", color: "#c084fc", share: 0.3, minSightings: 5 },
    { label: "LEGENDARY", color: "#fbbf24", share: 0.5, minSightings: 8 },
    { label: "MYTHIC", color: "#fb7185", share: 0.75, minSightings: 12 },
  ],
  requiredApprovals: 2,
  membersCanNominate: true,
  cohortLabel: "BATCH",
  cohortOptions: ["UG2026", "UG2025", "UG2024", "UG2023"],
};

/** Opt-in by construction: people add themselves, so consent isn't a question. */
export const EVENT_PRESET: DexConfig = {
  nounPlural: "ATTENDEES",
  nounSingular: "ATTENDEE",
  types: [
    { label: "FOUNDER", color: "#fbbf24", hint: "Has a deck on their phone." },
    { label: "ENGINEER", color: "#7c9cff", hint: "Asked about your stack first." },
    { label: "DESIGNER", color: "#e879f9", hint: "Noticed the kerning on the badge." },
    { label: "INVESTOR", color: "#22c55e", hint: "Keeps saying 'interesting'." },
    { label: "ORGANISER", color: "#ef4444", hint: "Has not sat down once." },
    { label: "SPEAKER", color: "#f59e0b", hint: "Still rehearsing in the corridor." },
    { label: "STUDENT", color: "#38bdf8", hint: "Here for the free food, learning anyway." },
    { label: "LURKER", color: "#94a3b8", hint: "Three talks in, zero conversations." },
    { label: "CONNECTOR", color: "#f472b6", hint: "Already introduced you to someone." },
    { label: "SKEPTIC", color: "#64748b", hint: "Has a question, and it is not friendly." },
  ],
  habitats: ["MAIN STAGE", "WORKSHOP ROOM", "THE BOOTHS", "COFFEE QUEUE", "HALLWAY TRACK", "AFTERPARTY"],
  stats: [
    { key: "presence", label: "PRESENCE", hint: "How much room they take up." },
    { key: "pitch", label: "PITCH", hint: "Seconds before they explain their company." },
    { key: "curiosity", label: "CURIOSITY", hint: "Asks more than they answer." },
    { key: "energy", label: "ENERGY", hint: "Still going at hour eight." },
    { key: "signal", label: "SIGNAL", hint: "Says something you write down." },
    { key: "mystery", label: "MYSTERY", hint: "Nobody is sure who invited them." },
  ],
  rarities: [
    { label: "SPOTTED", color: "#8b9bb4", share: 0, minSightings: 0 },
    { label: "KNOWN", color: "#38bdf8", share: 0.15, minSightings: 3 },
    { label: "NOTABLE", color: "#c084fc", share: 0.3, minSightings: 5 },
    { label: "HEADLINER", color: "#fbbf24", share: 0.5, minSightings: 8 },
    { label: "LEGEND", color: "#fb7185", share: 0.75, minSightings: 12 },
  ],
  requiredApprovals: 1,
  membersCanNominate: true,
  cohortLabel: "COMPANY",
  cohortOptions: [],
};

/** Deliberately bare — a starting point for anything that isn't people. */
export const BLANK_PRESET: DexConfig = {
  nounPlural: "ENTRIES",
  nounSingular: "ENTRY",
  types: [
    { label: "COMMON", color: "#94a3b8", hint: "" },
    { label: "ODD", color: "#c084fc", hint: "" },
    { label: "PRIZED", color: "#fbbf24", hint: "" },
  ],
  habitats: ["EVERYWHERE"],
  stats: [
    { key: "stat1", label: "STAT ONE", hint: "" },
    { key: "stat2", label: "STAT TWO", hint: "" },
    { key: "stat3", label: "STAT THREE", hint: "" },
    { key: "stat4", label: "STAT FOUR", hint: "" },
    { key: "stat5", label: "STAT FIVE", hint: "" },
    { key: "stat6", label: "STAT SIX", hint: "" },
  ],
  rarities: [
    { label: "COMMON", color: "#8b9bb4", share: 0, minSightings: 0 },
    { label: "UNCOMMON", color: "#38bdf8", share: 0.2, minSightings: 3 },
    { label: "RARE", color: "#c084fc", share: 0.4, minSightings: 6 },
    { label: "LEGENDARY", color: "#fbbf24", share: 0.7, minSightings: 10 },
  ],
  requiredApprovals: 1,
  membersCanNominate: true,
  cohortLabel: "",
  cohortOptions: [],
};

export const PRESETS: { id: string; name: string; blurb: string; config: DexConfig }[] = [
  {
    id: "campus",
    name: "CAMPUS",
    blurb: "A dex of the people on your campus. The original.",
    config: CAMPUS_PRESET,
  },
  {
    id: "event",
    name: "EVENT",
    blurb: "Conference or hackathon networking. Attendees add themselves.",
    config: EVENT_PRESET,
  },
  {
    id: "blank",
    name: "BLANK",
    blurb: "Bare bones. Name everything yourself.",
    config: BLANK_PRESET,
  },
];

export const DEFAULT_PRESET_ID = "campus";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

const HEX = /^#[0-9a-fA-F]{6}$/;

function text(v: unknown, max: number, fallback = ""): string {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
  return s || fallback;
}

function colour(v: unknown, i: number): string {
  return typeof v === "string" && HEX.test(v.trim())
    ? v.trim().toLowerCase()
    : FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** Drop entries that collide on label, case-insensitively. */
function dedupe<T>(items: T[], keyOf: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = keyOf(item).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Turn anything at all into a usable config. Every field is clamped or
 * replaced; a config that survives this is safe to render and safe to store.
 */
export function normaliseConfig(raw: unknown, base: DexConfig = CAMPUS_PRESET): DexConfig {
  const r = (raw ?? {}) as Partial<DexConfig>;

  const types = dedupe(
    (Array.isArray(r.types) ? r.types : [])
      .map((t, i) => ({
        label: text((t as TypeDef)?.label, 24).toUpperCase(),
        color: colour((t as TypeDef)?.color, i),
        hint: text((t as TypeDef)?.hint, 90),
      }))
      .filter((t) => t.label),
    (t) => t.label,
  ).slice(0, MAX_TYPES);

  const habitats = dedupe(
    (Array.isArray(r.habitats) ? r.habitats : [])
      .map((h) => text(h, 28).toUpperCase())
      .filter(Boolean)
      .map((label) => ({ label })),
    (h) => h.label,
  )
    .slice(0, MAX_HABITATS)
    .map((h) => h.label);

  // Stats are positional: the card always draws exactly six bars, so pad from
  // the base rather than letting a short array collapse the layout.
  const rawStats = Array.isArray(r.stats) ? r.stats : [];
  const stats: StatDef[] = Array.from({ length: STAT_COUNT }, (_, i) => {
    const s = rawStats[i] as StatDef | undefined;
    const fallback = base.stats[i] ?? BLANK_PRESET.stats[i];
    return {
      // The key is storage, not display: keep it stable and machine-safe.
      key:
        text(s?.key, 24)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "") || fallback.key,
      label: text(s?.label, 18, fallback.label).toUpperCase(),
      hint: text(s?.hint, 90),
    };
  });

  const rawRarities = Array.isArray(r.rarities) ? r.rarities : [];
  let rarities: RarityTier[] = dedupe(
    rawRarities
      .map((t, i) => ({
        label: text((t as RarityTier)?.label, 18).toUpperCase(),
        color: colour((t as RarityTier)?.color, i),
        share: clamp((t as RarityTier)?.share, 0, 1, 0),
        minSightings: Math.round(clamp((t as RarityTier)?.minSightings, 0, 10000, 0)),
      }))
      .filter((t) => t.label),
    (t) => t.label,
  ).slice(0, MAX_RARITIES);

  if (rarities.length < MIN_RARITIES) rarities = base.rarities.slice();

  // Ladders only make sense ascending, and the bottom rung must be reachable by
  // everyone — otherwise a new entry belongs to no tier at all.
  rarities.sort((a, b) => a.share - b.share || a.minSightings - b.minSightings);
  rarities[0] = { ...rarities[0], share: 0, minSightings: 0 };

  return {
    nounPlural: text(r.nounPlural, 20, base.nounPlural).toUpperCase(),
    nounSingular: text(r.nounSingular, 20, base.nounSingular).toUpperCase(),
    types: types.length ? types : base.types,
    habitats: habitats.length ? habitats : base.habitats,
    stats,
    rarities,
    requiredApprovals: Math.round(clamp(r.requiredApprovals, 1, 5, base.requiredApprovals)),
    membersCanNominate:
      typeof r.membersCanNominate === "boolean" ? r.membersCanNominate : base.membersCanNominate,
    cohortLabel: text(r.cohortLabel, 18).toUpperCase(),
    cohortOptions: dedupe(
      (Array.isArray(r.cohortOptions) ? r.cohortOptions : [])
        .map((c) => text(c, 24).toUpperCase())
        .filter(Boolean)
        .map((label) => ({ label })),
      (c) => c.label,
    )
      .slice(0, 40)
      .map((c) => c.label),
  };
}

/* -------------------------------------------------------------------------- */
/*  Slugs                                                                      */
/* -------------------------------------------------------------------------- */

/** Reserved because they are, or could become, real routes. */
export const RESERVED_SLUGS = new Set([
  "api", "kit", "admin", "dex", "d", "new", "login", "signin", "signup", "join",
  "settings", "about", "help", "terms", "privacy", "static", "_next", "public",
  "icon", "favicon", "opengraph-image", "robots", "sitemap", "me", "account",
]);

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "LINK NEEDS 3+ CHARACTERS";
  if (slug.length > 32) return "LINK TOO LONG";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return "LETTERS, NUMBERS AND HYPHENS ONLY";
  if (RESERVED_SLUGS.has(slug)) return "THAT LINK IS RESERVED";
  return null;
}
