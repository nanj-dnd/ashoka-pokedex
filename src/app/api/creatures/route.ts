import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/session";
import { storeError } from "@/lib/apiError";
import { activePlayers, listCreatures, saveCreature, seenCounts } from "@/lib/store";
import { BATCHES, HABITATS, STATS, TYPES } from "@/lib/constants";
import type { Creature, PublicCreature, Stats } from "@/lib/types";
import type { CreatureType } from "@/lib/constants";
import { standingFor } from "@/lib/rarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPublic(
  c: Creature,
  counts: Record<string, number>,
  players: number,
): PublicCreature {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { votes, submittedBy, status, ...rest } = c;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // Rarity is earned from sightings, never read from the row.
  return { ...rest, ...standingFor(counts[c.id] ?? 0, players) };
}

/**
 * GET /api/creatures
 *   ?scope=public   approved entries only (default)
 *   ?scope=pending  admin only — the approval queue, with vote history
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope") ?? "public";

  try {
    if (scope === "pending") {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
      }
      const pending = await listCreatures("pending");
      return NextResponse.json({ creatures: pending });
    }

    const [approved, counts, players] = await Promise.all([
      listCreatures("approved"),
      seenCounts(),
      activePlayers(),
    ]);
    const sorted = approved.sort((a, b) => (a.dexNumber ?? 0) - (b.dexNumber ?? 0));
    return NextResponse.json({
      activePlayers: players,
      creatures: sorted.map((c) => toPublic(c, counts, players)),
    });
  } catch (e) {
    return storeError(e);
  }
}

function clampStat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** POST /api/creatures — admin submits a new entry into the approval queue. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  const name = str(body.name, 40);
  if (!name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });

  const spriteUrl = str(body.spriteUrl, 500);
  if (!spriteUrl) return NextResponse.json({ error: "PHOTO REQUIRED" }, { status: 400 });

  const types = Array.isArray(body.types)
    ? (body.types.filter((t) => (TYPES as readonly string[]).includes(String(t))) as CreatureType[]).slice(0, 3)
    : [];

  const characteristics = Array.isArray(body.characteristics)
    ? body.characteristics.map((c) => String(c).trim().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];

  const rawStats = (body.stats ?? {}) as Record<string, unknown>;
  const stats = Object.fromEntries(
    STATS.map(({ key }) => [key, clampStat(rawStats[key])]),
  ) as Stats;

  const creature: Creature = {
    id: randomUUID(),
    dexNumber: null,
    name,
    title: str(body.title, 60),
    types,
    habitat: (HABITATS as readonly string[]).includes(str(body.habitat, 40))
      ? str(body.habitat, 40)
      : "",
    batch: (BATCHES as readonly string[]).includes(str(body.batch, 20))
      ? str(body.batch, 20)
      : "",
    characteristics,
    entry: str(body.entry, 400),
    quote: str(body.quote, 160),
    stats,
    spriteUrl,
    photoUrl: str(body.photoUrl, 500),
    status: "pending",
    submittedBy: session.handle,
    votes: [],
    createdAt: new Date().toISOString(),
    approvedAt: null,
  };

  try {
    await saveCreature(creature);
  } catch (e) {
    return storeError(e);
  }
  return NextResponse.json({ creature }, { status: 201 });
}
