import { NextResponse } from "next/server";
import { dexAdmin } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { deleteCreature, getCreature, saveCreature } from "@/lib/store";
import { readCreatureFields, str } from "@/lib/creatureInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; id: string }> };

/** PATCH — rewrite an entry after the fact. Admins of this dex only. */
export async function PATCH(req: Request, { params }: Params) {
  const { slug, id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  try {
    const dv = await dexAdmin(slug);
    if (!dv) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });

    const creature = await getCreature(id);
    if (!creature || creature.dexId !== dv.dex.id) {
      return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    }

    const fields = readCreatureFields(body, dv.dex.config);
    if (!fields.name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });

    // Sprite and photo are optional on an edit: leaving them out keeps what is
    // already there rather than blanking the entry.
    const spriteUrl = str(body.spriteUrl, 500) || creature.spriteUrl;
    const photoUrl =
      body.photoUrl === undefined ? creature.photoUrl : str(body.photoUrl, 500);

    const updated = {
      ...creature,
      ...fields,
      spriteUrl,
      photoUrl,
      updatedAt: new Date().toISOString(),
    };

    await saveCreature(updated);
    return NextResponse.json({ creature: updated });
  } catch (e) {
    return storeError(e);
  }
}

/** DELETE — remove an entry and every sighting of it. */
export async function DELETE(_req: Request, { params }: Params) {
  const { slug, id } = await params;
  try {
    const dv = await dexAdmin(slug);
    if (!dv) return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });

    const creature = await getCreature(id);
    if (!creature || creature.dexId !== dv.dex.id) {
      return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    }

    await deleteCreature(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
