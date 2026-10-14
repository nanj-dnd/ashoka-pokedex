import { NextResponse } from "next/server";
import { dexOwner } from "@/lib/auth";
import { getMembership, removeMembership, setMembership } from "@/lib/store";
import { storeError } from "@/lib/apiError";
import type { MemberRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * PATCH — change someone's role. Owner only.
 *
 * Ownership is deliberately not transferable here: it would need the other
 * person to accept, and a half-finished transfer leaves a dex with none.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { slug, id } = await params;
  const dv = await dexOwner(slug);
  if (!dv) return NextResponse.json({ error: "OWNER ONLY" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = body.role;
  if (role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "ROLE MUST BE ADMIN OR MEMBER" }, { status: 400 });
  }

  try {
    const existing = await getMembership(dv.dex.id, id);
    if (!existing) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 404 });
    if (existing.role === "owner") {
      return NextResponse.json({ error: "CANNOT CHANGE THE OWNER" }, { status: 400 });
    }

    await setMembership({ ...existing, role: role as MemberRole });
    return NextResponse.json({ ok: true, role });
  } catch (e) {
    return storeError(e);
  }
}

/** DELETE — remove someone from the dex. Owner only. */
export async function DELETE(_req: Request, { params }: Params) {
  const { slug, id } = await params;
  const dv = await dexOwner(slug);
  if (!dv) return NextResponse.json({ error: "OWNER ONLY" }, { status: 403 });

  try {
    const existing = await getMembership(dv.dex.id, id);
    if (!existing) return NextResponse.json({ ok: true });
    if (existing.role === "owner") {
      return NextResponse.json({ error: "CANNOT REMOVE THE OWNER" }, { status: 400 });
    }

    // Their entries and sightings stay: removing a person shouldn't silently
    // rewrite the dex's history or deflate everyone else's rarity.
    await removeMembership(dv.dex.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
