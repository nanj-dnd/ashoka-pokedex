import { NextResponse } from "next/server";
import { dexMember } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import {
  listAccountsByIds,
  listCreatures,
  listMembers,
  sightingCountsByAccount,
} from "@/lib/store";
import type { TrainerStanding } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** GET — the hall of fame for this dex. Members only. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  try {
    const dv = await dexMember(slug);
    if (!dv) return NextResponse.json({ error: "NOT A MEMBER" }, { status: 403 });
    const { dex } = dv;

    const members = await listMembers(dex.id);
    const [accounts, seenByAccount, all] = await Promise.all([
      listAccountsByIds(members.map((m) => m.accountId)),
      sightingCountsByAccount(dex.id),
      listCreatures(dex.id),
    ]);

    const byId = new Map(accounts.map((a) => [a.id, a]));

    // Submissions are credited by username, which is what the creature row
    // stores — ids would be better, but renaming is not a thing accounts do.
    const nominated = new Map<string, number>();
    const approved = new Map<string, number>();
    for (const c of all) {
      if (!c.submittedBy) continue;
      nominated.set(c.submittedBy, (nominated.get(c.submittedBy) ?? 0) + 1);
      if (c.status === "approved") {
        approved.set(c.submittedBy, (approved.get(c.submittedBy) ?? 0) + 1);
      }
    }

    const standings: TrainerStanding[] = members
      .map((m) => {
        const account = byId.get(m.accountId);
        if (!account) return null;
        return {
          id: account.id,
          username: account.username,
          role: m.role,
          joinedAt: m.joinedAt,
          seen: seenByAccount[account.id] ?? 0,
          nominations: nominated.get(account.username) ?? 0,
          approved: approved.get(account.username) ?? 0,
        };
      })
      .filter((s): s is TrainerStanding => s !== null)
      .sort((a, b) => b.seen - a.seen || b.approved - a.approved || a.joinedAt.localeCompare(b.joinedAt));

    const totalApproved = all.filter((c) => c.status === "approved").length;
    return NextResponse.json({ standings, totalApproved });
  } catch (e) {
    return storeError(e);
  }
}
