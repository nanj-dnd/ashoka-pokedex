import { LIMITS } from "./constants";
import type { DexConfig } from "./dexConfig";
import type { Stats } from "./types";

/**
 * Whitelisting for everything a client can put on an entry. Shared by the
 * capture endpoint and the admin editor so an edit can never smuggle in a
 * value the capture form would have rejected.
 *
 * Every whitelist is drawn from the DEX'S OWN config rather than a global
 * constant — one dex's valid habitat is another's nonsense.
 */

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function clampStat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function readTypes(v: unknown, config: DexConfig): string[] {
  if (!Array.isArray(v)) return [];
  const allowed = new Set(config.types.map((t) => t.label));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    const t = String(raw).trim().toUpperCase();
    if (allowed.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= LIMITS.typesPerEntry) break;
    }
  }
  return out;
}

export function readCharacteristics(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => String(c).trim().slice(0, LIMITS.trait))
    .filter(Boolean)
    .slice(0, LIMITS.traits);
}

/** Stats are positional by key; anything not in this dex's config is dropped. */
export function readStats(v: unknown, config: DexConfig): Stats {
  const raw = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    config.stats.map(({ key }) => [key, clampStat(raw[key])]),
  ) as Stats;
}

export function readHabitat(v: unknown, config: DexConfig): string {
  const h = str(v, LIMITS.habitat).toUpperCase();
  return config.habitats.includes(h) ? h : "";
}

/**
 * The cohort field is free text when the owner defined no options — "COMPANY"
 * at a conference can't be enumerated in advance the way a batch year can.
 */
export function readCohort(v: unknown, config: DexConfig): string {
  if (!config.cohortLabel) return "";
  const c = str(v, LIMITS.cohort).toUpperCase();
  if (!config.cohortOptions.length) return c;
  return config.cohortOptions.includes(c) ? c : "";
}

/** The editable half of an entry — everything except identity and workflow. */
export interface CreatureFields {
  name: string;
  title: string;
  types: string[];
  habitat: string;
  cohort: string;
  characteristics: string[];
  entry: string;
  quote: string;
  stats: Stats;
}

export function readCreatureFields(
  body: Record<string, unknown>,
  config: DexConfig,
): CreatureFields {
  return {
    name: str(body.name, LIMITS.name),
    title: str(body.title, LIMITS.title),
    types: readTypes(body.types, config),
    habitat: readHabitat(body.habitat, config),
    cohort: readCohort(body.cohort, config),
    characteristics: readCharacteristics(body.characteristics),
    entry: str(body.entry, LIMITS.entry),
    quote: str(body.quote, LIMITS.quote),
    stats: readStats(body.stats, config),
  };
}
