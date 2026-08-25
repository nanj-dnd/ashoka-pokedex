import { NextResponse } from "next/server";
import { viewer } from "@/lib/auth";
import { activePlayers, getCreature, seenCountFor, setSighting, sightingsForAccount } from "@/lib/store";
import { storeError } from "@/lib/apiError";
import { standingFor } from "@/lib/rarity";
import { announceRarity } from "@/lib/notify";
import { mailEnabled } from "@/lib/mail";

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

  // A sighting can push someone up a rarity tier. Only ever on the way up, so
  // un-marking is skipped, and only when there is somewhere to send the news.
  if (seen && mailEnabled) {
    try {
      const creature = await getCreature(creatureId);
      if (creature?.status === "approved") {
        const [count, players] = await Promise.all([
          seenCountFor(creatureId),
          activePlayers(),
        ]);
        await announceRarity(creature, standingFor(count, players).rarity);
      }
    } catch (e) {
      // The sighting is recorded either way; the mail is the optional part.
      console.error(`sighting alert: ${String((e as Error).message)}`);
    }
  }

  return NextResponse.json({ ok: true });
}
