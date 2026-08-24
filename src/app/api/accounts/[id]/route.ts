import { NextResponse } from "next/server";
import { adminViewer } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { deleteAccount, findAccountById, updateAccountRole } from "@/lib/store";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admins manage other people's accounts, never their own. Locking yourself out
 * of your own admin terminal by mis-clicking is the one mistake here that
 * nobody else can undo for you.
 */
function guardSelf(meId: string, targetId: string): NextResponse | null {
  return meId === targetId
    ? NextResponse.json({ error: "NOT ON YOUR OWN ACCOUNT" }, { status: 403 })
    : null;
}

/** PATCH /api/accounts/:id  { role: "admin" | "public" } — promote or demote. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { role } = (await req.json().catch(() => ({}))) as { role?: string };
  if (role !== "admin" && role !== "public") {
    return NextResponse.json({ error: "BAD ROLE" }, { status: 400 });
  }

  try {
    const me = await adminViewer();
    if (!me) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
    const blocked = guardSelf(me.accountId, id);
    if (blocked) return blocked;

    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    if (target.role !== role) await updateAccountRole(id, role as Role);
    // The change bites immediately: every request reads the role from the row,
    // not from the session cookie the target is still carrying around.
    return NextResponse.json({ account: { id: target.id, username: target.username, role } });
  } catch (e) {
    return storeError(e);
  }
}

/** DELETE /api/accounts/:id — remove an account and its sightings. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const me = await adminViewer();
    if (!me) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
    const blocked = guardSelf(me.accountId, id);
    if (blocked) return blocked;

    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });

    await deleteAccount(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
