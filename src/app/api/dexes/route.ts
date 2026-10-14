import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { viewer } from "@/lib/auth";
import { generateCode } from "@/lib/session";
import {
  createDex,
  getDexBySlug,
  listCreatures,
  listMembershipsForAccount,
  memberCount,
  setMembership,
  getDexById,
} from "@/lib/store";
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  normaliseConfig,
  slugProblem,
  slugify,
} from "@/lib/dexConfig";
import { LIMITS } from "@/lib/constants";
import { storeError } from "@/lib/apiError";
import type { Dex, DexSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/** GET — every dex this account belongs to, with their standing in each. */
export async function GET() {
  const v = await viewer();
  if (!v) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  try {
    const memberships = await listMembershipsForAccount(v.accountId);

    const dexes: DexSummary[] = [];
    for (const m of memberships) {
      const dex = await getDexById(m.dexId);
      if (!dex) continue; // deleted out from under the membership
      const [approved, members] = await Promise.all([
        listCreatures(dex.id, "approved"),
        memberCount(dex.id),
      ]);
      dexes.push({
        slug: dex.slug,
        name: dex.name,
        tagline: dex.tagline,
        role: m.role,
        entries: approved.length,
        members,
        joinedAt: m.joinedAt,
      });
    }

    dexes.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    return NextResponse.json({ dexes });
  } catch (e) {
    return storeError(e);
  }
}

/**
 * POST — create a dex. The creator becomes its owner.
 *
 * Codes are generated rather than chosen: an owner picking "1234" for both
 * would hand admin rights to everyone who guessed, and the pair must differ.
 */
export async function POST(req: Request) {
  const v = await viewer();
  if (!v) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = text(body.name, LIMITS.dexName);
  if (!name) return NextResponse.json({ error: "NAME REQUIRED" }, { status: 400 });

  const slug = slugify(text(body.slug, 40) || name);
  const problem = slugProblem(slug);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const presetId = typeof body.preset === "string" ? body.preset : DEFAULT_PRESET_ID;
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  // A client may post a full config (the create form previews one); otherwise
  // the preset stands in. Either way it goes through the normaliser.
  const config = normaliseConfig(body.config ?? preset.config, preset.config);

  try {
    if (await getDexBySlug(slug)) {
      return NextResponse.json({ error: "LINK TAKEN" }, { status: 409 });
    }

    const adminCode = generateCode();
    let memberCode = generateCode();
    while (memberCode === adminCode) memberCode = generateCode();

    const dex: Dex = {
      id: randomUUID(),
      slug,
      name,
      tagline: text(body.tagline, LIMITS.tagline),
      ownerId: v.accountId,
      config,
      adminCode,
      memberCode,
      listed: false,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    const created = await createDex(dex);
    await setMembership({
      dexId: created.id,
      accountId: v.accountId,
      role: "owner",
      joinedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      dex: {
        slug: created.slug,
        name: created.name,
        tagline: created.tagline,
        adminCode: created.adminCode,
        memberCode: created.memberCode,
      },
    });
  } catch (e) {
    if (String((e as Error).message) === "LINK TAKEN") {
      return NextResponse.json({ error: "LINK TAKEN" }, { status: 409 });
    }
    return storeError(e);
  }
}
