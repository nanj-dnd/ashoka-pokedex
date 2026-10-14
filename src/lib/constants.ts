/**
 * Engine-wide constants.
 *
 * Everything that describes a particular community — types, habitats, stats,
 * the rarity ladder, how many approvals an entry needs — moved to per-dex
 * config in lib/dexConfig.ts. What is left here is true of every dex on the
 * deployment, because it is about the image pipeline or the product's limits.
 */

/** How many entries a member may have sitting in the queue at once. */
export const MAX_OPEN_NOMINATIONS = 3;

/**
 * Sprite resolution. Low enough to read as pixel art, high enough that you can
 * actually tell who it is — recognising the subject is the point of a dex, so
 * fidelity wins over purity.
 */
export const SPRITE_SIZE = 160;

/**
 * Colour levels per channel when quantising. 5 (125 colours) crushed skin tones
 * into flat blocks; 8 gives 512 and keeps features readable.
 */
export const SPRITE_LEVELS = 8;

/** Slight punch, not a poster effect. */
export const SPRITE_SATURATION = 1.15;

/** Long edge of the stored full-colour photo. */
export const PHOTO_SIZE = 720;

/** Hard ceilings, enforced server-side on every write. */
export const LIMITS = {
  name: 40,
  title: 60,
  habitat: 40,
  cohort: 24,
  entry: 400,
  quote: 160,
  trait: 40,
  traits: 8,
  typesPerEntry: 3,
  dexName: 40,
  tagline: 80,
} as const;
