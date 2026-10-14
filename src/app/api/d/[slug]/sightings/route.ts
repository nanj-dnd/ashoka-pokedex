import { NextResponse } from "next/server";
import { dexMember } from "@/lib/auth";
import { getCreature, setSighting, sightingsForAccount } from "@/lib/store";
import { storeError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** Seen marks belong to the account, so they follow you across devices. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  try {
    const dv = await dexMember(slug);
    if (!dv) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 403 });
    return NextResponse.json({ seen: await sightingsForAccount(dv.accountId, dv.dex.id) });
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const { creatureId, seen } = (await req.json().catch(() => ({}))) as {
    creatureId?: string;
    seen?: boolean;
  };
  if (typeof creatureId !== "string" || !creatureId) {
    return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });
  }

  try {
    const dv = await dexMember(slug);
    if (!dv) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 403 });

    // Marking an entry from another dex would quietly inflate its rarity, so
    // the creature has to belong to the dex in the path.
    const creature = await getCreature(creatureId);
    if (!creature || creature.dexId !== dv.dex.id || creature.status !== "approved") {
      return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
    }

    await setSighting(creatureId, dv.accountId, Boolean(seen));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storeError(e);
  }
}
