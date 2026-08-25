import { NextResponse } from "next/server";
import { adminViewer } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { deleteCreature, getCreature, nextDexNumber, saveCreature } from "@/lib/store";
import { readCreatureFields, str } from "@/lib/creatureInput";
import { notifyApproved } from "@/lib/notify";
import { BASE_RARITY } from "@/lib/constants";
import type { CreatureStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: CreatureStatus[] = ["pending", "approved", "rejected"];

/**
 * PATCH /api/creatures/:id
 *   { fields?, spriteUrl?, photoUrl?, status? }
 *
 * The admin override. Any entry can be rewritten after the fact — people's
 * dex entries are about real people, and getting one wrong is the sort of
 * thing that should be fixable in ten seconds rather than by deleting and
 * re-shooting them.
 *
 * `status` moves an entry between the queue and the dex by hand:
 *   pending   — pull a live entry back for review. Votes are cleared so it
 *               needs a fresh quorum, but its dex number is held in reserve.
 *   approved  — put it in now, without waiting for the quorum.
 *   rejected  — take it off the wall.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  try {
    const me = await adminViewer();
    if (!me) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });

    const creature = await getCreature(id);
    if (!creature) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });

    let touched = false;
    // Only a first arrival in the dex is worth an email; pulling an entry back
    // and putting it in again is bookkeeping, not news.
    let announce = false;

    if (body.fields && typeof body.fields === "object") {
      const fields = readCreatureFields(body.fields as Record<string, unknown>);
      if (!fields.name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });
      Object.assign(creature, fields);
      touched = true;
    }

    if (typeof body.spriteUrl === "string" && body.spriteUrl) {
      creature.spriteUrl = str(body.spriteUrl, 500);
      // A replaced sprite comes with its own full-size photo, or none at all.
      creature.photoUrl = str(body.photoUrl, 500);
      touched = true;
    }

    if (typeof body.status === "string") {
      const status = body.status as CreatureStatus;
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "BAD STATUS" }, { status: 400 });
      }
      if (status !== creature.status) {
        if (status === "pending") {
          creature.votes = [];
          creature.approvedAt = null;
        }
        if (status === "approved") {
          creature.approvedAt = creature.approvedAt ?? new Date().toISOString();
          // Held numbers survive a trip back through the queue.
          creature.dexNumber = creature.dexNumber ?? (await nextDexNumber());
          announce = !creature.notifiedRarity;
          creature.notifiedRarity = creature.notifiedRarity ?? BASE_RARITY;
        }
        creature.status = status;
        touched = true;
      }
    }

    if (!touched) return NextResponse.json({ error: "NOTHING TO CHANGE" }, { status: 400 });

    creature.updatedAt = new Date().toISOString();
    await saveCreature(creature);
    if (announce) await notifyApproved(creature);
    return NextResponse.json({ creature });
  } catch (e) {
    return storeError(e);
  }
}

/** DELETE /api/creatures/:id — admin removes an entry outright. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const me = await adminViewer();
    if (!me) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
    await deleteCreature(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
