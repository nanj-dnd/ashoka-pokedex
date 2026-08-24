import { BATCHES, HABITATS, STATS, TYPES } from "./constants";
import type { CreatureType } from "./constants";
import type { Stats } from "./types";

/**
 * Whitelisting for everything a client can put on a creature. Shared by the
 * capture endpoint and the admin editor so an edit can never smuggle in a
 * value the capture form would have rejected.
 */

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function clampStat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function readTypes(v: unknown): CreatureType[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return v
    .map((t) => String(t))
    .filter((t) => (TYPES as readonly string[]).includes(t) && !seen.has(t) && seen.add(t))
    .slice(0, 3) as CreatureType[];
}

export function readCharacteristics(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => String(c).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 8);
}

export function readStats(v: unknown): Stats {
  const raw = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(STATS.map(({ key }) => [key, clampStat(raw[key])])) as Stats;
}

export function readHabitat(v: unknown): string {
  const h = str(v, 40);
  return (HABITATS as readonly string[]).includes(h) ? h : "";
}

export function readBatch(v: unknown): string {
  const b = str(v, 20);
  return (BATCHES as readonly string[]).includes(b) ? b : "";
}

/** The editable half of a creature — everything except identity and workflow. */
export interface CreatureFields {
  name: string;
  title: string;
  types: CreatureType[];
  habitat: string;
  batch: string;
  characteristics: string[];
  entry: string;
  quote: string;
  stats: Stats;
}

export function readCreatureFields(body: Record<string, unknown>): CreatureFields {
  return {
    name: str(body.name, 40),
    title: str(body.title, 60),
    types: readTypes(body.types),
    habitat: readHabitat(body.habitat),
    batch: readBatch(body.batch),
    characteristics: readCharacteristics(body.characteristics),
    entry: str(body.entry, 400),
    quote: str(body.quote, 160),
    stats: readStats(body.stats),
  };
}
