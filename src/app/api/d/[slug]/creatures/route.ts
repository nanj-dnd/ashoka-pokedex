import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { dexMember } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { listCreatures, memberCount, saveCreature, seenCounts } from "@/lib/store";
import { MAX_OPEN_NOMINATIONS } from "@/lib/constants";
import { readCreatureFields, str } from "@/lib/creatureInput";
import { canAdmin, type Creature, type MyNomination, type PublicCreature } from "@/lib/types";
import { standingFor } from "@/lib/rarity";
import type { DexConfig } from "@/lib/dexConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function toPublic(
  c: Creature,
  counts: Record<string, number>,
  players: number,
  config: DexConfig,
): PublicCreature {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { votes, submittedBy, submittedByRole, status, dexId, ...rest } = c;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // Rarity is earned from sightings and from THIS dex's ladder, never read
  // from the row.
  return {
    ...rest,
    caughtBy: submittedBy,
    ...standingFor(counts[c.id] ?? 0, players, config),
  };
}

/** A member sees the fate of their own nominations, but never who voted. */
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
 * GET /api/d/<slug>/creatures
 *   ?scope=public   approved entries only (default)
 *   ?scope=pending  admin only — the approval queue, with vote history
 *   ?scope=all      admin only — every entry, whatever its status
 *   ?scope=mine     your own submissions and where they got to
 */
export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const scope = new URL(req.url).searchParams.get("scope") ?? "public";

  try {
    const dv = await dexMember(slug);
    if (!dv) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 403 });
    const { dex, role } = dv;

    if (scope === "pending" || scope === "all") {
      if (!canAdmin(role)) {
        return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
      }
      const rows = await listCreatures(dex.id, scope === "pending" ? "pending" : undefined);
      return NextResponse.json({ creatures: rows });
    }

    if (scope === "mine") {
      const all = await listCreatures(dex.id);
      const mine = all
        .filter((c) => c.submittedBy === dv.username)
        .map((c) => toMine(c, dex.config.requiredApprovals));
      return NextResponse.json({ nominations: mine, openLimit: MAX_OPEN_NOMINATIONS });
    }

    const [approved, counts, players] = await Promise.all([
      listCreatures(dex.id, "approved"),
      seenCounts(dex.id),
      memberCount(dex.id),
    ]);
    const sorted = approved.sort((a, b) => (a.dexNumber ?? 0) - (b.dexNumber ?? 0));
    return NextResponse.json({
      activePlayers: players,
      creatures: sorted.map((c) => toPublic(c, counts, players, dex.config)),
    });
  } catch (e) {
    return storeError(e);
  }
}

/**
 * POST — put a new entry into this dex's approval queue.
 *
 * Admins capture; members nominate if the owner allows it. Both land as
 * `pending` and need the same quorum, so a nomination is not a shortcut in.
 * Members are capped at MAX_OPEN_NOMINATIONS at once — otherwise one bored
 * person can bury the queue.
 */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  try {
    const dv = await dexMember(slug);
    if (!dv) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 403 });
    const { dex, role, username } = dv;
    const isAdmin = canAdmin(role);

    if (!isAdmin && !dex.config.membersCanNominate) {
      return NextResponse.json({ error: "ONLY ADMINS CAN ADD TO THIS DEX" }, { status: 403 });
    }

    const fields = readCreatureFields(body, dex.config);
    if (!fields.name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });

    const spriteUrl = str(body.spriteUrl, 500);
    if (!spriteUrl) return NextResponse.json({ error: "PHOTO REQUIRED" }, { status: 400 });

    if (!isAdmin) {
      const open = (await listCreatures(dex.id, "pending")).filter(
        (c) => c.submittedBy === username,
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
      dexId: dex.id,
      dexNumber: null,
      ...fields,
      spriteUrl,
      photoUrl: str(body.photoUrl, 500),
      status: "pending",
      submittedBy: username,
      submittedByRole: isAdmin ? "admin" : "member",
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
