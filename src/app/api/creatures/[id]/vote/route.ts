import { NextResponse } from "next/server";
import { adminViewer } from "@/lib/auth";
import { requiredApprovals } from "@/lib/session";
import { storeError } from "@/lib/apiError";
import { getCreature, nextDexNumber, saveCreature } from "@/lib/store";
import type { Vote } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/creatures/:id/vote  { vote: "approve" | "reject", force?: boolean }
 *
 * House rules:
 *   - admins only, and never on your own submission
 *   - one vote per admin (voting again replaces your previous vote)
 *   - REQUIRED_APPROVALS distinct approvals promotes the entry to the public dex
 *   - the same number of rejections kills it
 *
 * `force` skips the count and resolves the entry on this one vote. It does not
 * skip the conflict-of-interest rule: an override still cannot be used on your
 * own catch, because that is the only thing keeping the queue honest.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { vote?: string; force?: boolean };
  const vote = body.vote;
  if (vote !== "approve" && vote !== "reject") {
    return NextResponse.json({ error: "BAD VOTE" }, { status: 400 });
  }

  try {
    const me = await adminViewer();
    if (!me) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });

    const creature = await getCreature(id);
    if (!creature) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    if (creature.status !== "pending") {
      return NextResponse.json({ error: "ALREADY RESOLVED" }, { status: 409 });
    }
    if (creature.submittedBy === me.username) {
      return NextResponse.json({ error: "CANNOT VOTE ON YOUR OWN CATCH" }, { status: 403 });
    }

    const force = body.force === true;
    const next: Vote = {
      username: me.username,
      vote,
      at: new Date().toISOString(),
      ...(force ? { forced: true } : {}),
    };
    const votes = [...creature.votes.filter((v) => v.username !== me.username), next];

    const approvals = votes.filter((v) => v.vote === "approve").length;
    const rejections = votes.filter((v) => v.vote === "reject").length;
    const needed = requiredApprovals();

    creature.votes = votes;

    if (force || rejections >= needed || approvals >= needed) {
      // Rejection still wins a tie, exactly as it did before overrides existed.
      const approved = force ? vote === "approve" : rejections < needed && approvals >= needed;
      if (approved) {
        creature.status = "approved";
        creature.approvedAt = new Date().toISOString();
        creature.dexNumber = creature.dexNumber ?? (await nextDexNumber());
      } else {
        creature.status = "rejected";
      }
      await saveCreature(creature);
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
