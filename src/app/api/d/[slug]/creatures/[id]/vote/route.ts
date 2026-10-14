import { NextResponse } from "next/server";
import { dexAdmin } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { getCreature, nextDexNumber, saveCreature } from "@/lib/store";
import { notifyApproved } from "@/lib/notify";
import type { Vote } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * POST — { vote: "approve" | "reject", force?: boolean }
 *
 * House rules:
 *   - admins of THIS dex only, and never on your own submission
 *   - one vote per admin (voting again replaces your previous vote)
 *   - the dex's own requiredApprovals promotes the entry; the same number of
 *     rejections kills it
 *
 * `force` skips the count and resolves on this one vote. It does not skip the
 * conflict-of-interest rule: an override still cannot be used on your own
 * catch, because that is the only thing keeping the queue honest.
 */
export async function POST(req: Request, { params }: Params) {
  const { slug, id } = await params;
  const body = (await req.json().catch(() => ({}))) as { vote?: string; force?: boolean };
  const vote = body.vote;
  if (vote !== "approve" && vote !== "reject") {
    return NextResponse.json({ error: "BAD VOTE" }, { status: 400 });
  }

  try {
    const dv = await dexAdmin(slug);
    if (!dv) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
    const { dex, username } = dv;

    const creature = await getCreature(id);
    if (!creature) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    // An id from another dex must not be reachable just because you admin this
    // one, so check ownership rather than trusting the path.
    if (creature.dexId !== dex.id) {
      return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    }
    if (creature.status !== "pending") {
      return NextResponse.json({ error: "ALREADY RESOLVED" }, { status: 409 });
    }
    if (creature.submittedBy === username) {
      return NextResponse.json({ error: "CANNOT VOTE ON YOUR OWN CATCH" }, { status: 403 });
    }

    const force = body.force === true;
    const next: Vote = {
      username,
      vote,
      at: new Date().toISOString(),
      ...(force ? { forced: true } : {}),
    };
    const votes = [...creature.votes.filter((v) => v.username !== username), next];

    const approvals = votes.filter((v) => v.vote === "approve").length;
    const rejections = votes.filter((v) => v.vote === "reject").length;
    const needed = dex.config.requiredApprovals;

    creature.votes = votes;

    if (force || rejections >= needed || approvals >= needed) {
      // Rejection still wins a tie, exactly as it did before overrides existed.
      const approved = force ? vote === "approve" : rejections < needed && approvals >= needed;
      if (approved) {
        creature.status = "approved";
        creature.approvedAt = new Date().toISOString();
        creature.dexNumber = creature.dexNumber ?? (await nextDexNumber(dex.id));
        // Everyone enters at the bottom rung; recording it here is what makes a
        // later climb read as an evolution rather than a first announcement.
        creature.notifiedRarity = creature.notifiedRarity ?? dex.config.rarities[0].label;
      } else {
        creature.status = "rejected";
      }
      await saveCreature(creature);
      if (approved) await notifyApproved(creature, dex);
      return NextResponse.json({
        creature,
        resolved: approved ? "approved" : "rejected",
        forced: force,
      });
    }

    await saveCreature(creature);
    return NextResponse.json({ creature, approvals, needed });
  } catch (e) {
    return storeError(e);
  }
}
