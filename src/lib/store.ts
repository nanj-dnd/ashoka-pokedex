import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BASE_RARITY } from "./constants";
import type { Creature, CreatureStatus } from "./types";

/* -------------------------------------------------------------------------- */
/*  Backend selection                                                          */
/* -------------------------------------------------------------------------- */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "dex-media";

export const usingSupabase = Boolean(SUPABASE_URL && SERVICE_KEY);

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/* -------------------------------------------------------------------------- */
/*  Local JSON backend (zero-infra fallback)                                   */
/* -------------------------------------------------------------------------- */

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "dex.json");
const MEDIA_DIR = path.join(DATA_DIR, "media");

interface LocalDb {
  creatures: Creature[];
  sightings: { creatureId: string; deviceId: string }[];
}

/**
 * The local JSON store writes to the working directory, which is read-only on
 * serverless hosts like Vercel. Failing here with an explanation beats an
 * ENOENT from deep inside fs once the site is already live.
 */
function assertLocalUsable(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No Supabase configuration found. The local JSON store cannot run on a " +
        "serverless host — its filesystem is read-only. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY in the environment.",
    );
  }
}

async function readLocal(): Promise<LocalDb> {
  assertLocalUsable();
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as LocalDb;
  } catch {
    return { creatures: [], sightings: [] };
  }
}

async function writeLocal(data: LocalDb): Promise<void> {
  assertLocalUsable();
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, DB_FILE); // atomic-ish swap
}

/* -------------------------------------------------------------------------- */
/*  Row <-> Creature mapping                                                   */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCreature(row: any): Creature {
  return {
    id: row.id,
    dexNumber: row.dex_number,
    name: row.name,
    title: row.title ?? "",
    types: row.types ?? [],
    habitat: row.habitat ?? "",
    batch: row.batch ?? "",
    characteristics: row.characteristics ?? [],
    entry: row.entry ?? "",
    quote: row.quote ?? "",
    stats: row.stats ?? {},
    spriteUrl: row.sprite_url ?? "",
    photoUrl: row.photo_url ?? "",
    status: row.status,
    submittedBy: row.submitted_by ?? "",
    votes: row.votes ?? [],
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

function toRow(c: Creature): Record<string, unknown> {
  return {
    id: c.id,
    dex_number: c.dexNumber,
    name: c.name,
    title: c.title,
    types: c.types,
    // The column is NOT NULL and legacy; rarity is computed at read time now
    // (see lib/rarity.ts), so this value is written but never read back.
    rarity: BASE_RARITY,
    habitat: c.habitat,
    batch: c.batch,
    characteristics: c.characteristics,
    entry: c.entry,
    quote: c.quote,
    stats: c.stats,
    sprite_url: c.spriteUrl,
    photo_url: c.photoUrl,
    status: c.status,
    submitted_by: c.submittedBy,
    votes: c.votes,
    created_at: c.createdAt,
    approved_at: c.approvedAt,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function listCreatures(status?: CreatureStatus): Promise<Creature[]> {
  if (usingSupabase) {
    let q = db().from("creatures").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(`listCreatures: ${error.message}`);
    return (data ?? []).map(toCreature);
  }
  const local = await readLocal();
  const rows = status ? local.creatures.filter((c) => c.status === status) : local.creatures;
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCreature(id: string): Promise<Creature | null> {
  if (usingSupabase) {
    const { data, error } = await db().from("creatures").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getCreature: ${error.message}`);
    return data ? toCreature(data) : null;
  }
  const local = await readLocal();
  return local.creatures.find((c) => c.id === id) ?? null;
}

export async function saveCreature(creature: Creature): Promise<Creature> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("creatures")
      .upsert(toRow(creature))
      .select()
      .single();
    if (error) throw new Error(`saveCreature: ${error.message}`);
    return toCreature(data);
  }
  const local = await readLocal();
  const i = local.creatures.findIndex((c) => c.id === creature.id);
  if (i >= 0) local.creatures[i] = creature;
  else local.creatures.push(creature);
  await writeLocal(local);
  return creature;
}

export async function deleteCreature(id: string): Promise<void> {
  if (usingSupabase) {
    const { error } = await db().from("creatures").delete().eq("id", id);
    if (error) throw new Error(`deleteCreature: ${error.message}`);
    return;
  }
  const local = await readLocal();
  local.creatures = local.creatures.filter((c) => c.id !== id);
  local.sightings = local.sightings.filter((s) => s.creatureId !== id);
  await writeLocal(local);
}

/** Next free dex number. Assigned at approval so public numbers stay dense. */
export async function nextDexNumber(): Promise<number> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("creatures")
      .select("dex_number")
      .not("dex_number", "is", null)
      .order("dex_number", { ascending: false })
      .limit(1);
    if (error) throw new Error(`nextDexNumber: ${error.message}`);
    return (data?.[0]?.dex_number ?? 0) + 1;
  }
  const local = await readLocal();
  const max = local.creatures.reduce((m, c) => Math.max(m, c.dexNumber ?? 0), 0);
  return max + 1;
}

/* -------------------------------- sightings ------------------------------- */

export async function setSighting(
  creatureId: string,
  deviceId: string,
  seen: boolean,
): Promise<void> {
  if (usingSupabase) {
    if (seen) {
      const { error } = await db()
        .from("sightings")
        .upsert({ creature_id: creatureId, device_id: deviceId }, { onConflict: "creature_id,device_id" });
      if (error) throw new Error(`setSighting: ${error.message}`);
    } else {
      const { error } = await db()
        .from("sightings")
        .delete()
        .eq("creature_id", creatureId)
        .eq("device_id", deviceId);
      if (error) throw new Error(`setSighting: ${error.message}`);
    }
    return;
  }
  const local = await readLocal();
  local.sightings = local.sightings.filter(
    (s) => !(s.creatureId === creatureId && s.deviceId === deviceId),
  );
  if (seen) local.sightings.push({ creatureId, deviceId });
  await writeLocal(local);
}

export async function sightingsForDevice(deviceId: string): Promise<string[]> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("sightings")
      .select("creature_id")
      .eq("device_id", deviceId);
    if (error) throw new Error(`sightingsForDevice: ${error.message}`);
    return (data ?? []).map((r) => r.creature_id as string);
  }
  const local = await readLocal();
  return local.sightings.filter((s) => s.deviceId === deviceId).map((s) => s.creatureId);
}

/** creatureId -> how many distinct devices have marked it seen. */
export async function seenCounts(): Promise<Record<string, number>> {
  if (usingSupabase) {
    const { data, error } = await db().from("sightings").select("creature_id");
    if (error) throw new Error(`seenCounts: ${error.message}`);
    const out: Record<string, number> = {};
    for (const r of data ?? []) out[r.creature_id as string] = (out[r.creature_id as string] ?? 0) + 1;
    return out;
  }
  const local = await readLocal();
  const out: Record<string, number> = {};
  for (const s of local.sightings) out[s.creatureId] = (out[s.creatureId] ?? 0) + 1;
  return out;
}

/**
 * How many distinct devices are actually playing — the denominator for earned
 * rarity. Derived from sightings rather than a separate table: someone who has
 * never marked anyone seen isn't participating in the ranking.
 */
export async function activePlayers(): Promise<number> {
  if (usingSupabase) {
    const { data, error } = await db().from("sightings").select("device_id");
    if (error) throw new Error(`activePlayers: ${error.message}`);
    return new Set((data ?? []).map((r) => r.device_id as string)).size;
  }
  const local = await readLocal();
  return new Set(local.sightings.map((s) => s.deviceId)).size;
}

/* ---------------------------------- media --------------------------------- */

/** Store an image and return a URL the browser can load it from. */
export async function putMedia(
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (usingSupabase) {
    const { error } = await db()
      .storage.from(BUCKET)
      .upload(filename, body, { contentType, upsert: true });
    if (error) throw new Error(`putMedia: ${error.message}`);
    const { data } = db().storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  }
  assertLocalUsable();
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, filename), body);
  return `/api/media/${filename}`;
}

/** Local-backend only: read a stored image back out for /api/media. */
export async function getLocalMedia(filename: string): Promise<Buffer | null> {
  // Defend against traversal — only a bare filename is ever valid here.
  if (filename.includes("/") || filename.includes("..") || filename.includes("\\")) return null;
  try {
    return await fs.readFile(path.join(MEDIA_DIR, filename));
  } catch {
    return null;
  }
}
