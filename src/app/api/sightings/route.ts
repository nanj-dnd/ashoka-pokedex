import { NextResponse } from "next/server";
import { viewer } from "@/lib/auth";
import { setSighting, sightingsForAccount } from "@/lib/store";
import { storeError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seen marks belong to the signed-in account, so they follow you across devices. */
export async function GET() {
  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
    return NextResponse.json({ seen: await sightingsForAccount(me.accountId) });
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(req: Request) {
  const { creatureId, seen } = (await req.json().catch(() => ({}))) as {
    creatureId?: string;
    seen?: boolean;
  };
  if (typeof creatureId !== "string" || !creatureId) {
    return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });
  }

  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
    await setSighting(creatureId, me.accountId, Boolean(seen));
  } catch (e) {
    return storeError(e);
  }
  return NextResponse.json({ ok: true });
}
