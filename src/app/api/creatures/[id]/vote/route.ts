import { NextResponse } from "next/server";
import { getSession, requiredApprovals } from "@/lib/session";
import { deleteCreature, getCreature, nextDexNumber, saveCreature } from "@/lib/store";
import type { Vote } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/creatures/:id/vote  { vote: "approve" | "reject" }
 *
 * House rules:
 *   - admins only, and never on your own submission
 *   - one vote per handle (voting again replaces your previous vote)
 *   - REQUIRED_APPROVALS distinct approvals promotes the entry to the public dex
 *   - the same number of rejections kills it
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { vote } = (await req.json().catch(() => ({}))) as { vote?: string };
  if (vote !== "approve" && vote !== "reject") {
    return NextResponse.json({ error: "BAD VOTE" }, { status: 400 });
  }

  const creature = await getCreature(id);
  if (!creature) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
  if (creature.status !== "pending") {
    return NextResponse.json({ error: "ALREADY RESOLVED" }, { status: 409 });
  }
  if (creature.submittedBy === session.handle) {
    return NextResponse.json({ error: "CANNOT VOTE ON YOUR OWN CATCH" }, { status: 403 });
  }

  const next: Vote = { handle: session.handle, vote, at: new Date().toISOString() };
  const votes = [...creature.votes.filter((v) => v.handle !== session.handle), next];

  const approvals = votes.filter((v) => v.vote === "approve").length;
  const rejections = votes.filter((v) => v.vote === "reject").length;
  const needed = requiredApprovals();

  creature.votes = votes;

  if (rejections >= needed) {
    creature.status = "rejected";
    await saveCreature(creature);
    return NextResponse.json({ creature, resolved: "rejected" });
  }

  if (approvals >= needed) {
    creature.status = "approved";
    creature.approvedAt = new Date().toISOString();
    creature.dexNumber = await nextDexNumber();
    await saveCreature(creature);
    return NextResponse.json({ creature, resolved: "approved" });
  }

  await saveCreature(creature);
  return NextResponse.json({ creature, approvals, needed });
}

/** DELETE /api/creatures/:id — admin removes an entry outright. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deleteCreature(id);
  return NextResponse.json({ ok: true });
}
