/**
 * The game vocabulary for the Ashoka Pokedex.
 * Everything here is display-facing — edit freely to re-flavour the dex.
 */

export const RARITIES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
] as const;

export type Rarity = (typeof RARITIES)[number];

/** Frame + glow colours per rarity, consumed by CSS custom properties. */
export const RARITY_STYLE: Record<Rarity, { ink: string; glow: string; label: string }> = {
  COMMON: { ink: "#8b9bb4", glow: "rgba(139,155,180,0.45)", label: "COMMON" },
  UNCOMMON: { ink: "#4ade80", glow: "rgba(74,222,128,0.45)", label: "UNCOMMON" },
  RARE: { ink: "#38bdf8", glow: "rgba(56,189,248,0.5)", label: "RARE" },
  EPIC: { ink: "#c084fc", glow: "rgba(192,132,252,0.55)", label: "EPIC" },
  LEGENDARY: { ink: "#fbbf24", glow: "rgba(251,191,36,0.6)", label: "LEGENDARY" },
  MYTHIC: { ink: "#fb7185", glow: "rgba(251,113,133,0.65)", label: "MYTHIC" },
};

/** Roughly how many of each rarity should exist — shown as guidance in admin. */
export const RARITY_HINT: Record<Rarity, string> = {
  COMMON: "You see them every single day.",
  UNCOMMON: "Reliably around, if you know where to look.",
  RARE: "A good week if you spot them.",
  EPIC: "Sightings get reported to friends.",
  LEGENDARY: "Half the campus doubts they exist.",
  MYTHIC: "One of one. Handle with reverence.",
};

/** Pokemon-style typing, re-cut for campus life. */
export const TYPES = [
  "ACADEMIC",
  "MESS",
  "DHABA",
  "LIBRARY",
  "SPORTS",
  "THEATRE",
  "MUSIC",
  "DEBATE",
  "NIGHTOWL",
  "SOCIETY",
  "POLITICS",
  "ART",
  "CODE",
  "FILM",
  "FITNESS",
  "WANDERER",
] as const;

export type CreatureType = (typeof TYPES)[number];

export const TYPE_COLOR: Record<CreatureType, string> = {
  ACADEMIC: "#7c9cff",
  MESS: "#f59e0b",
  DHABA: "#ef4444",
  LIBRARY: "#a78bfa",
  SPORTS: "#22c55e",
  THEATRE: "#e879f9",
  MUSIC: "#f472b6",
  DEBATE: "#facc15",
  NIGHTOWL: "#6366f1",
  SOCIETY: "#2dd4bf",
  POLITICS: "#fb923c",
  ART: "#c4b5fd",
  CODE: "#4ade80",
  FILM: "#94a3b8",
  FITNESS: "#f87171",
  WANDERER: "#38bdf8",
};

/** Where this creature is usually encountered. */
export const HABITATS = [
  "THE MESS",
  "THE DHABA",
  "THE LIBRARY",
  "AC-01",
  "AC-02",
  "AC-03",
  "SPORTS BLOCK",
  "AMPHITHEATRE",
  "RESIDENCE HALL",
  "THE LAWN",
  "CAFETERIA",
  "ROAMING",
] as const;

/** The six-stat block, drawn as pixel bars on the card. */
export const STATS = [
  { key: "vibe", label: "VIBE" },
  { key: "chaos", label: "CHAOS" },
  { key: "academia", label: "ACADEMIA" },
  { key: "social", label: "SOCIAL" },
  { key: "stamina", label: "STAMINA" },
  { key: "mystery", label: "MYSTERY" },
] as const;

export type StatKey = (typeof STATS)[number]["key"];

/** Sprite resolution. Small on purpose — it is the whole aesthetic. */
export const SPRITE_SIZE = 96;
/** Long edge of the stored full-colour photo. */
export const PHOTO_SIZE = 720;
