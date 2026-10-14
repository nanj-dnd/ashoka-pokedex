import { NextResponse } from "next/server";
import { viewer } from "@/lib/auth";
import { roleForDexCode } from "@/lib/session";
import { getDexBySlug, getMembership, setMembership, removeMembership } from "@/lib/store";
import { storeError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST — join a dex with its code.
 *
 * The code decides the role you join at. Someone already inside who enters the
 * admin code is promoted, which is how an owner hands out admin without a
 * management screen: tell them the other code.
 *
 * An owner can never be demoted this way — a dex must keep exactly one.
 */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const v = await viewer();
  if (!v) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";

  try {
    const dex = await getDexBySlug(slug);
    if (!dex) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });

    const existing = await getMembership(dex.id, v.accountId);
    if (existing?.role === "owner") {
      return NextResponse.json({ role: "owner", alreadyIn: true });
    }

    const role = roleForDexCode(dex, code);
    if (!role) return NextResponse.json({ error: "WRONG CODE" }, { status: 401 });

    // Entering the member code when you are already an admin shouldn't quietly
    // strip your rights — only ever move up.
    if (existing?.role === "admin" && role === "member") {
      return NextResponse.json({ role: "admin", alreadyIn: true });
    }

    await setMembership({
      dexId: dex.id,
      accountId: v.accountId,
      role,
      joinedAt: existing?.joinedAt ?? new Date().toISOString(),
    });

    return NextResponse.json({ role, alreadyIn: Boolean(existing) });
  } catch (e) {
    return storeError(e);
  }
}

/** DELETE — leave a dex. Owners must transfer or delete instead. */
export async function DELETE(_req: Request, { params }: Params) {
  const { slug } = await params;
  const v = await viewer();
  if (!v) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  try {
    const dex = await getDexBySlug(slug);
    if (!dex) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });

    const existing = await getMembership(dex.id, v.accountId);
    if (!existing) return NextResponse.json({ ok: true });
    if (existing.role === "owner") {
      return NextResponse.json(
        { error: "AN OWNER CANNOT LEAVE — DELETE THE DEX INSTEAD" },
        { status: 400 },
      );
    }

    await removeMembership(dex.id, v.accountId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
