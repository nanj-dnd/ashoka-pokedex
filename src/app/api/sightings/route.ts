import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setSighting, sightingsForAccount } from "@/lib/store";
import { storeError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seen marks belong to the signed-in account, so they follow you across devices. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
  try {
    return NextResponse.json({ seen: await sightingsForAccount(session.accountId) });
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  const { creatureId, seen } = (await req.json().catch(() => ({}))) as {
    creatureId?: string;
    seen?: boolean;
  };
  if (typeof creatureId !== "string" || !creatureId) {
    return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });
  }

  try {
    await setSighting(creatureId, session.accountId, Boolean(seen));
  } catch (e) {
    return storeError(e);
  }
  return NextResponse.json({ ok: true });
}
