import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setSighting, sightingsForDevice } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Seen" is per-device, not per-account — there are no accounts, just codes.
 * The client mints a random device id into localStorage and sends it here.
 */
function deviceId(req: Request): string | null {
  const id = req.headers.get("x-device-id");
  if (!id || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) return null;
  return id;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
  const id = deviceId(req);
  if (!id) return NextResponse.json({ seen: [] });
  return NextResponse.json({ seen: await sightingsForDevice(id) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
  const id = deviceId(req);
  if (!id) return NextResponse.json({ error: "NO DEVICE" }, { status: 400 });

  const { creatureId, seen } = (await req.json().catch(() => ({}))) as {
    creatureId?: string;
    seen?: boolean;
  };
  if (typeof creatureId !== "string" || !creatureId) {
    return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });
  }

  await setSighting(creatureId, id, Boolean(seen));
  return NextResponse.json({ ok: true });
}
