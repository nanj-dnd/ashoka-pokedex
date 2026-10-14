import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normaliseConfig } from "./dexConfig";
import type {
  Account,
  Creature,
  CreatureStatus,
  Dex,
  MemberRole,
  Membership,
} from "./types";

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
  dexes: Dex[];
  memberships: Membership[];
  creatures: Creature[];
  sightings: { creatureId: string; accountId: string }[];
  accounts: Account[];
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
    const raw = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Partial<LocalDb>;
    return {
      dexes: raw.dexes ?? [],
      memberships: raw.memberships ?? [],
      creatures: raw.creatures ?? [],
      sightings: raw.sightings ?? [],
      accounts: raw.accounts ?? [],
    };
  } catch {
    return { dexes: [], memberships: [], creatures: [], sightings: [], accounts: [] };
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
/*  Row mapping                                                                */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCreature(row: any): Creature {
  return {
    id: row.id,
    dexId: row.dex_id,
    dexNumber: row.dex_number,
    name: row.name,
    title: row.title ?? "",
    types: row.types ?? [],
    habitat: row.habitat ?? "",
    cohort: row.cohort ?? "",
    characteristics: row.characteristics ?? [],
    entry: row.entry ?? "",
    quote: row.quote ?? "",
    stats: row.stats ?? {},
    spriteUrl: row.sprite_url ?? "",
    photoUrl: row.photo_url ?? "",
    status: row.status,
    submittedBy: row.submitted_by ?? "",
    submittedByRole: row.submitted_by_role === "member" ? "member" : "admin",
    votes: row.votes ?? [],
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at ?? null,
    notifiedRarity: row.notified_rarity ?? null,
  };
}

function creatureRow(c: Creature): Record<string, unknown> {
  return {
    id: c.id,
    dex_id: c.dexId,
    dex_number: c.dexNumber,
    name: c.name,
    title: c.title,
    types: c.types,
    habitat: c.habitat,
    cohort: c.cohort,
    characteristics: c.characteristics,
    entry: c.entry,
    quote: c.quote,
    stats: c.stats,
    sprite_url: c.spriteUrl,
    photo_url: c.photoUrl,
    status: c.status,
    submitted_by: c.submittedBy,
    submitted_by_role: c.submittedByRole,
    votes: c.votes,
    created_at: c.createdAt,
    approved_at: c.approvedAt,
    updated_at: c.updatedAt,
    notified_rarity: c.notifiedRarity,
  };
}

function toDex(row: any): Dex {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? "",
    ownerId: row.owner_id,
    // Config is user-authored JSON. Never hand it out unnormalised.
    config: normaliseConfig(row.config),
    adminCode: row.admin_code,
    memberCode: row.member_code,
    listed: Boolean(row.listed),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function dexRow(d: Dex): Record<string, unknown> {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    owner_id: d.ownerId,
    config: d.config,
    admin_code: d.adminCode,
    member_code: d.memberCode,
    listed: d.listed,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

function toAccount(row: any): Account {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    email: row.email ?? "",
    alerts: row.alerts !== false,
  };
}

function toMembership(row: any): Membership {
  return {
    dexId: row.dex_id,
    accountId: row.account_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------------------------------------------------- */
/*  Dexes                                                                      */
/* -------------------------------------------------------------------------- */

export async function getDexBySlug(slug: string): Promise<Dex | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  if (usingSupabase) {
    const { data, error } = await db().from("dexes").select("*").ilike("slug", key).limit(1);
    if (error) throw new Error(`getDexBySlug: ${error.message}`);
    return data?.[0] ? toDex(data[0]) : null;
  }
  const local = await readLocal();
  return local.dexes.find((d) => d.slug.toLowerCase() === key) ?? null;
}

export async function getDexById(id: string): Promise<Dex | null> {
  if (usingSupabase) {
    const { data, error } = await db().from("dexes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getDexById: ${error.message}`);
    return data ? toDex(data) : null;
  }
  const local = await readLocal();
  return local.dexes.find((d) => d.id === id) ?? null;
}

export async function createDex(dex: Dex): Promise<Dex> {
  if (usingSupabase) {
    const { data, error } = await db().from("dexes").insert(dexRow(dex)).select().single();
    // 23505 = unique violation, i.e. the slug was taken between check and insert.
    if (error) {
      throw new Error(error.code === "23505" ? "LINK TAKEN" : `createDex: ${error.message}`);
    }
    return toDex(data);
  }
  const local = await readLocal();
  if (local.dexes.some((d) => d.slug.toLowerCase() === dex.slug.toLowerCase())) {
    throw new Error("LINK TAKEN");
  }
  local.dexes.push(dex);
  await writeLocal(local);
  return dex;
}

export async function updateDex(dex: Dex): Promise<Dex> {
  const next = { ...dex, updatedAt: new Date().toISOString() };
  if (usingSupabase) {
    const { data, error } = await db()
      .from("dexes")
      .update(dexRow(next))
      .eq("id", dex.id)
      .select()
      .single();
    if (error) throw new Error(`updateDex: ${error.message}`);
    return toDex(data);
  }
  const local = await readLocal();
  local.dexes = local.dexes.map((d) => (d.id === dex.id ? next : d));
  await writeLocal(local);
  return next;
}

export async function deleteDex(id: string): Promise<void> {
  if (usingSupabase) {
    const { error } = await db().from("dexes").delete().eq("id", id);
    if (error) throw new Error(`deleteDex: ${error.message}`);
    return;
  }
  const local = await readLocal();
  const creatureIds = new Set(local.creatures.filter((c) => c.dexId === id).map((c) => c.id));
  local.dexes = local.dexes.filter((d) => d.id !== id);
  local.memberships = local.memberships.filter((m) => m.dexId !== id);
  local.creatures = local.creatures.filter((c) => c.dexId !== id);
  local.sightings = local.sightings.filter((s) => !creatureIds.has(s.creatureId));
  await writeLocal(local);
}

/* -------------------------------------------------------------------------- */
/*  Memberships                                                                */
/* -------------------------------------------------------------------------- */

export async function getMembership(
  dexId: string,
  accountId: string,
): Promise<Membership | null> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("memberships")
      .select("*")
      .eq("dex_id", dexId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (error) throw new Error(`getMembership: ${error.message}`);
    return data ? toMembership(data) : null;
  }
  const local = await readLocal();
  return local.memberships.find((m) => m.dexId === dexId && m.accountId === accountId) ?? null;
}

export async function setMembership(m: Membership): Promise<Membership> {
  if (usingSupabase) {
    const { error } = await db()
      .from("memberships")
      .upsert(
        { dex_id: m.dexId, account_id: m.accountId, role: m.role, joined_at: m.joinedAt },
        { onConflict: "dex_id,account_id" },
      );
    if (error) throw new Error(`setMembership: ${error.message}`);
    return m;
  }
  const local = await readLocal();
  const existing = local.memberships.find(
    (x) => x.dexId === m.dexId && x.accountId === m.accountId,
  );
  if (existing) {
    // Keep the original join date — a role change isn't a re-join.
    existing.role = m.role;
  } else {
    local.memberships.push(m);
  }
  await writeLocal(local);
  return m;
}

export async function removeMembership(dexId: string, accountId: string): Promise<void> {
  if (usingSupabase) {
    const { error } = await db()
      .from("memberships")
      .delete()
      .eq("dex_id", dexId)
      .eq("account_id", accountId);
    if (error) throw new Error(`removeMembership: ${error.message}`);
    return;
  }
  const local = await readLocal();
  local.memberships = local.memberships.filter(
    (m) => !(m.dexId === dexId && m.accountId === accountId),
  );
  await writeLocal(local);
}

export async function listMembers(dexId: string): Promise<Membership[]> {
  if (usingSupabase) {
    const { data, error } = await db().from("memberships").select("*").eq("dex_id", dexId);
    if (error) throw new Error(`listMembers: ${error.message}`);
    return (data ?? []).map(toMembership);
  }
  const local = await readLocal();
  return local.memberships.filter((m) => m.dexId === dexId);
}

export async function listMembershipsForAccount(accountId: string): Promise<Membership[]> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("memberships")
      .select("*")
      .eq("account_id", accountId);
    if (error) throw new Error(`listMembershipsForAccount: ${error.message}`);
    return (data ?? []).map(toMembership);
  }
  const local = await readLocal();
  return local.memberships.filter((m) => m.accountId === accountId);
}

/**
 * Everyone in this dex — the denominator for earned rarity. A headcount of
 * members, not of people who happen to have been active.
 */
export async function memberCount(dexId: string): Promise<number> {
  if (usingSupabase) {
    const { count, error } = await db()
      .from("memberships")
      .select("account_id", { count: "exact", head: true })
      .eq("dex_id", dexId);
    if (error) throw new Error(`memberCount: ${error.message}`);
    return count ?? 0;
  }
  const local = await readLocal();
  return local.memberships.filter((m) => m.dexId === dexId).length;
}

/* -------------------------------------------------------------------------- */
/*  Creatures                                                                  */
/* -------------------------------------------------------------------------- */

export async function listCreatures(
  dexId: string,
  status?: CreatureStatus,
): Promise<Creature[]> {
  if (usingSupabase) {
    let q = db().from("creatures").select("*").eq("dex_id", dexId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(`listCreatures: ${error.message}`);
    return (data ?? []).map(toCreature);
  }
  const local = await readLocal();
  return local.creatures.filter((c) => c.dexId === dexId && (!status || c.status === status));
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
      .upsert(creatureRow(creature))
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

/** Dex numbers restart at 1 for every dex. */
export async function nextDexNumber(dexId: string): Promise<number> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("creatures")
      .select("dex_number")
      .eq("dex_id", dexId)
      .not("dex_number", "is", null)
      .order("dex_number", { ascending: false })
      .limit(1);
    if (error) throw new Error(`nextDexNumber: ${error.message}`);
    return ((data?.[0]?.dex_number as number) ?? 0) + 1;
  }
  const local = await readLocal();
  const max = local.creatures
    .filter((c) => c.dexId === dexId)
    .reduce((m, c) => Math.max(m, c.dexNumber ?? 0), 0);
  return max + 1;
}

/* -------------------------------------------------------------------------- */
/*  Sightings                                                                  */
/* -------------------------------------------------------------------------- */

export async function setSighting(
  creatureId: string,
  accountId: string,
  seen: boolean,
): Promise<void> {
  if (usingSupabase) {
    if (seen) {
      const { error } = await db()
        .from("sightings")
        .upsert(
          { creature_id: creatureId, account_id: accountId },
          { onConflict: "creature_id,account_id" },
        );
      if (error) throw new Error(`setSighting: ${error.message}`);
    } else {
      const { error } = await db()
        .from("sightings")
        .delete()
        .eq("creature_id", creatureId)
        .eq("account_id", accountId);
      if (error) throw new Error(`setSighting: ${error.message}`);
    }
    return;
  }
  const local = await readLocal();
  local.sightings = local.sightings.filter(
    (s) => !(s.creatureId === creatureId && s.accountId === accountId),
  );
  if (seen) local.sightings.push({ creatureId, accountId });
  await writeLocal(local);
}

/** This account's seen list within one dex. */
export async function sightingsForAccount(
  accountId: string,
  dexId: string,
): Promise<string[]> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("sightings")
      .select("creature_id, creatures!inner(dex_id)")
      .eq("account_id", accountId)
      .eq("creatures.dex_id", dexId);
    if (error) throw new Error(`sightingsForAccount: ${error.message}`);
    return (data ?? []).map((r) => (r as { creature_id: string }).creature_id);
  }
  const local = await readLocal();
  const inDex = new Set(local.creatures.filter((c) => c.dexId === dexId).map((c) => c.id));
  return local.sightings
    .filter((s) => s.accountId === accountId && inDex.has(s.creatureId))
    .map((s) => s.creatureId);
}

/** creatureId -> how many people have marked it seen, for one dex. */
export async function seenCounts(dexId: string): Promise<Record<string, number>> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("sightings")
      .select("creature_id, creatures!inner(dex_id)")
      .eq("creatures.dex_id", dexId);
    if (error) throw new Error(`seenCounts: ${error.message}`);
    const out: Record<string, number> = {};
    for (const r of data ?? []) {
      const id = (r as { creature_id: string }).creature_id;
      out[id] = (out[id] ?? 0) + 1;
    }
    return out;
  }
  const local = await readLocal();
  const inDex = new Set(local.creatures.filter((c) => c.dexId === dexId).map((c) => c.id));
  const out: Record<string, number> = {};
  for (const s of local.sightings) {
    if (inDex.has(s.creatureId)) out[s.creatureId] = (out[s.creatureId] ?? 0) + 1;
  }
  return out;
}

export async function seenCountFor(creatureId: string): Promise<number> {
  if (usingSupabase) {
    const { count, error } = await db()
      .from("sightings")
      .select("account_id", { count: "exact", head: true })
      .eq("creature_id", creatureId);
    if (error) throw new Error(`seenCountFor: ${error.message}`);
    return count ?? 0;
  }
  const local = await readLocal();
  return local.sightings.filter((s) => s.creatureId === creatureId).length;
}

/** accountId -> how many entries they have marked seen, within one dex. */
export async function sightingCountsByAccount(
  dexId: string,
): Promise<Record<string, number>> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("sightings")
      .select("account_id, creatures!inner(dex_id, status)")
      .eq("creatures.dex_id", dexId)
      .eq("creatures.status", "approved");
    if (error) throw new Error(`sightingCountsByAccount: ${error.message}`);
    const out: Record<string, number> = {};
    for (const r of data ?? []) {
      const id = (r as { account_id: string }).account_id;
      out[id] = (out[id] ?? 0) + 1;
    }
    return out;
  }
  const local = await readLocal();
  const approved = new Set(
    local.creatures.filter((c) => c.dexId === dexId && c.status === "approved").map((c) => c.id),
  );
  const out: Record<string, number> = {};
  for (const s of local.sightings) {
    if (approved.has(s.creatureId)) out[s.accountId] = (out[s.accountId] ?? 0) + 1;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Accounts                                                                   */
/* -------------------------------------------------------------------------- */

export async function findAccountByUsername(username: string): Promise<Account | null> {
  if (usingSupabase) {
    // ilike with no wildcards is an exact, case-insensitive match.
    const { data, error } = await db()
      .from("accounts")
      .select("*")
      .ilike("username", username)
      .limit(1);
    if (error) throw new Error(`findAccountByUsername: ${error.message}`);
    return data?.[0] ? toAccount(data[0]) : null;
  }
  const local = await readLocal();
  const key = username.toLowerCase();
  return local.accounts.find((a) => a.username.toLowerCase() === key) ?? null;
}

export async function findAccountById(id: string): Promise<Account | null> {
  if (usingSupabase) {
    const { data, error } = await db().from("accounts").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`findAccountById: ${error.message}`);
    return data ? toAccount(data) : null;
  }
  const local = await readLocal();
  return local.accounts.find((a) => a.id === id) ?? null;
}

export async function listAccountsByIds(ids: string[]): Promise<Account[]> {
  if (!ids.length) return [];
  if (usingSupabase) {
    const { data, error } = await db().from("accounts").select("*").in("id", ids);
    if (error) throw new Error(`listAccountsByIds: ${error.message}`);
    return (data ?? []).map(toAccount);
  }
  const local = await readLocal();
  const want = new Set(ids);
  return local.accounts.filter((a) => want.has(a.id));
}

export async function createAccount(account: Account): Promise<Account> {
  if (usingSupabase) {
    const { data, error } = await db()
      .from("accounts")
      .insert({
        id: account.id,
        username: account.username,
        password_hash: account.passwordHash,
        email: account.email || null,
        alerts: account.alerts,
        created_at: account.createdAt,
      })
      .select()
      .single();
    if (error) {
      throw new Error(error.code === "23505" ? "USERNAME TAKEN" : `createAccount: ${error.message}`);
    }
    return toAccount(data);
  }
  const local = await readLocal();
  if (local.accounts.some((a) => a.username.toLowerCase() === account.username.toLowerCase())) {
    throw new Error("USERNAME TAKEN");
  }
  local.accounts.push(account);
  await writeLocal(local);
  return account;
}

/** Partial so a caller can change the address, the switch, or both. */
export async function updateAccountAlerts(
  id: string,
  patch: { email?: string; alerts?: boolean },
): Promise<void> {
  if (usingSupabase) {
    const row: Record<string, unknown> = {};
    // An empty address must become NULL, not "", or the partial unique index
    // treats every opted-out account as colliding with the others.
    if (patch.email !== undefined) row.email = patch.email || null;
    if (patch.alerts !== undefined) row.alerts = patch.alerts;
    if (!Object.keys(row).length) return;

    const { error } = await db().from("accounts").update(row).eq("id", id);
    if (error) {
      throw new Error(
        error.code === "23505" ? "EMAIL ALREADY IN USE" : `updateAccountAlerts: ${error.message}`,
      );
    }
    return;
  }
  const local = await readLocal();
  if (patch.email) {
    const taken = local.accounts.some(
      (a) => a.id !== id && a.email && a.email.toLowerCase() === patch.email!.toLowerCase(),
    );
    if (taken) throw new Error("EMAIL ALREADY IN USE");
  }
  local.accounts = local.accounts.map((a) =>
    a.id === id
      ? {
          ...a,
          email: patch.email !== undefined ? patch.email : a.email,
          alerts: patch.alerts !== undefined ? patch.alerts : a.alerts,
        }
      : a,
  );
  await writeLocal(local);
}

/* -------------------------------------------------------------------------- */
/*  Media                                                                      */
/* -------------------------------------------------------------------------- */

export async function putMedia(
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (usingSupabase) {
    const { error } = await db().storage.from(BUCKET).upload(filename, body, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`putMedia: ${error.message}`);
    return db().storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
  }
  assertLocalUsable();
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, filename), body);
  return `/api/media/${filename}`;
}

export async function getLocalMedia(filename: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(MEDIA_DIR, filename));
  } catch {
    return null;
  }
}

export type { MemberRole };
