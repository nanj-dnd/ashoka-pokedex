import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { viewer } from "@/lib/auth";
import { requiredApprovals } from "@/lib/session";
import { storeError } from "@/lib/apiError";
import { activePlayers, listCreatures, saveCreature, seenCounts } from "@/lib/store";
import { MAX_OPEN_NOMINATIONS } from "@/lib/constants";
import { readCreatureFields, str } from "@/lib/creatureInput";
import type { Creature, MyNomination, PublicCreature } from "@/lib/types";
import { standingFor } from "@/lib/rarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPublic(
  c: Creature,
  counts: Record<string, number>,
  players: number,
): PublicCreature {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { votes, submittedBy, submittedByRole, status, ...rest } = c;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // Rarity is earned from sightings, never read from the row.
  return { ...rest, caughtBy: submittedBy, ...standingFor(counts[c.id] ?? 0, players) };
}

/** A trainer sees the fate of their own nominations, but never who voted. */
function toMine(c: Creature, needed: number): MyNomination {
  return {
    id: c.id,
    name: c.name,
    spriteUrl: c.spriteUrl,
    status: c.status,
    dexNumber: c.dexNumber,
    createdAt: c.createdAt,
    approvals: c.votes.filter((v) => v.vote === "approve").length,
    rejections: c.votes.filter((v) => v.vote === "reject").length,
    needed,
  };
}

/**
 * GET /api/creatures
 *   ?scope=public   approved entries only (default)
 *   ?scope=pending  admin only — the approval queue, with vote history
 *   ?scope=all      admin only — every entry, whatever its status
 *   ?scope=mine     your own submissions and where they got to
 */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "public";

  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

    if (scope === "pending" || scope === "all") {
      if (me.role !== "admin") {
        return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
      }
      const rows = await listCreatures(scope === "pending" ? "pending" : undefined);
      return NextResponse.json({ creatures: rows });
    }

    if (scope === "mine") {
      const all = await listCreatures();
      const needed = requiredApprovals();
      const mine = all
        .filter((c) => c.submittedBy === me.username)
        .map((c) => toMine(c, needed));
      return NextResponse.json({ nominations: mine, openLimit: MAX_OPEN_NOMINATIONS });
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

/**
 * POST /api/creatures — put a new entry into the approval queue.
 *
 * Admins capture; trainers nominate. Both land as `pending` and need the same
 * quorum of admins to get in, so a nomination is not a shortcut into the dex.
 * Trainers are capped at MAX_OPEN_NOMINATIONS open at once — otherwise one
 * bored person can bury the queue.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

    const fields = readCreatureFields(body);
    if (!fields.name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });

    const spriteUrl = str(body.spriteUrl, 500);
    if (!spriteUrl) return NextResponse.json({ error: "PHOTO REQUIRED" }, { status: 400 });

    if (me.role !== "admin") {
      const open = (await listCreatures("pending")).filter(
        (c) => c.submittedBy === me.username,
      ).length;
      if (open >= MAX_OPEN_NOMINATIONS) {
        return NextResponse.json(
          { error: `YOU ALREADY HAVE ${MAX_OPEN_NOMINATIONS} NOMINATIONS WAITING` },
          { status: 429 },
        );
      }
    }

    const creature: Creature = {
      id: randomUUID(),
      dexNumber: null,
      ...fields,
      spriteUrl,
      photoUrl: str(body.photoUrl, 500),
      status: "pending",
      submittedBy: me.username,
      submittedByRole: me.role,
      votes: [],
      createdAt: new Date().toISOString(),
      approvedAt: null,
      updatedAt: null,
      notifiedRarity: null,
    };

    await saveCreature(creature);
    return NextResponse.json({ creature }, { status: 201 });
  } catch (e) {
    return storeError(e);
  }
}
