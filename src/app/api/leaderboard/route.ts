import { NextResponse } from "next/server";
import { viewer } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { listAccounts, listCreatures, sightingCountsByAccount } from "@/lib/store";
import type { TrainerStanding } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard — the hall of fame.
 *
 * Aggregates only. How much of the dex someone has filled in and how many
 * catches they have contributed is the scoreboard; *which* entries a given
 * trainer has ticked off stays private to them.
 */
export async function GET() {
  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

    const [accounts, creatures, seenByAccount] = await Promise.all([
      listAccounts(),
      listCreatures(),
      sightingCountsByAccount(),
    ]);

    const approved = creatures.filter((c) => c.status === "approved");

    // Submissions are credited by username, which is unique and case-insensitive.
    const nominated = new Map<string, { total: number; approved: number }>();
    for (const c of creatures) {
      const key = c.submittedBy.toLowerCase();
      if (!key) continue;
      const tally = nominated.get(key) ?? { total: 0, approved: 0 };
      tally.total += 1;
      if (c.status === "approved") tally.approved += 1;
      nominated.set(key, tally);
    }

    const trainers: TrainerStanding[] = accounts.map((a) => {
      const credit = nominated.get(a.username.toLowerCase());
      return {
        id: a.id,
        username: a.username,
        role: a.role,
        joinedAt: a.createdAt,
        seen: seenByAccount[a.id] ?? 0,
        nominations: credit?.total ?? 0,
        approved: credit?.approved ?? 0,
      };
    });

    // Most of the dex filled in wins; contributions break the tie, then seniority.
    trainers.sort(
      (a, b) =>
        b.seen - a.seen ||
        b.approved - a.approved ||
        a.joinedAt.localeCompare(b.joinedAt),
    );

    return NextResponse.json({
      trainers,
      totalApproved: approved.length,
      activePlayers: accounts.length,
    });
  } catch (e) {
    return storeError(e);
  }
}
