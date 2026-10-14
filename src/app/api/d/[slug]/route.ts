import { NextResponse } from "next/server";
import { dexOwner, dexViewer } from "@/lib/auth";
import { deleteDex, listMembers, memberCount, updateDex } from "@/lib/store";
import { normaliseConfig } from "@/lib/dexConfig";
import { LIMITS } from "@/lib/constants";
import { storeError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/**
 * GET — the dex as this viewer may see it.
 *
 * Codes are included only for admins, because the whole point of a code is
 * that you hand it out deliberately. A member who could read the admin code
 * could promote themselves by re-joining with it.
 */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  try {
    const dv = await dexViewer(slug);
    if (!dv) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });

    const { dex, role, isAdmin } = { ...dv, isAdmin: dv.role === "owner" || dv.role === "admin" };

    return NextResponse.json({
      dex: {
        slug: dex.slug,
        name: dex.name,
        tagline: dex.tagline,
        config: dex.config,
        listed: dex.listed,
        createdAt: dex.createdAt,
      },
      role,
      members: await memberCount(dex.id),
      ...(isAdmin
        ? { codes: { admin: dex.adminCode, member: dex.memberCode } }
        : {}),
    });
  } catch (e) {
    return storeError(e);
  }
}

/** PATCH — rewrite the dex's constraints. Owner only. */
export async function PATCH(req: Request, { params }: Params) {
  const { slug } = await params;
  const dv = await dexOwner(slug);
  if (!dv) return NextResponse.json({ error: "OWNER ONLY" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const next = { ...dv.dex };

    if (body.name !== undefined) {
      const name = text(body.name, LIMITS.dexName);
      if (!name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });
      next.name = name;
    }
    if (body.tagline !== undefined) next.tagline = text(body.tagline, LIMITS.tagline);
    if (body.listed !== undefined) next.listed = Boolean(body.listed);

    if (body.config !== undefined) {
      // Normalise against the CURRENT config, so a partial edit that drops a
      // field inherits this dex's value rather than snapping back to a preset.
      next.config = normaliseConfig(body.config, dv.dex.config);
    }

    const saved = await updateDex(next);
    return NextResponse.json({
      dex: {
        slug: saved.slug,
        name: saved.name,
        tagline: saved.tagline,
        config: saved.config,
        listed: saved.listed,
      },
    });
  } catch (e) {
    return storeError(e);
  }
}

/**
 * DELETE — remove the dex and everything in it. Owner only, and the owner must
 * type the slug back, because this cascades to every entry and membership.
 */
export async function DELETE(req: Request, { params }: Params) {
  const { slug } = await params;
  const dv = await dexOwner(slug);
  if (!dv) return NextResponse.json({ error: "OWNER ONLY" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (text(body.confirm, 64).toLowerCase() !== dv.dex.slug.toLowerCase()) {
    return NextResponse.json({ error: "TYPE THE DEX LINK TO CONFIRM" }, { status: 400 });
  }

  try {
    const members = await listMembers(dv.dex.id);
    await deleteDex(dv.dex.id);
    return NextResponse.json({ ok: true, removedMembers: members.length });
  } catch (e) {
    return storeError(e);
  }
}
