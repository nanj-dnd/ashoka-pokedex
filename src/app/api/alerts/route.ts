import { NextResponse } from "next/server";
import { viewer } from "@/lib/auth";
import { storeError } from "@/lib/apiError";
import { findAccountById, updateAccountAlerts } from "@/lib/store";
import { isValidEmail, mailEnabled, normaliseEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/alerts — your own address and whether alerts are on. */
export async function GET() {
  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
    const account = await findAccountById(me.accountId);
    if (!account) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });
    return NextResponse.json({
      email: account.email,
      alerts: account.alerts,
      // The UI says so plainly rather than promising mail that cannot be sent.
      configured: mailEnabled,
    });
  } catch (e) {
    return storeError(e);
  }
}

/**
 * PATCH /api/alerts  { email?, alerts? }
 *
 * Your own settings only. Admins manage roles, never someone else's inbox.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ error: "NO SESSION" }, { status: 401 });

    const patch: { email?: string; alerts?: boolean } = {};

    if (body.email !== undefined) {
      const email = normaliseEmail(body.email);
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: "THAT EMAIL DOES NOT LOOK RIGHT" }, { status: 400 });
      }
      patch.email = email;
    }
    if (typeof body.alerts === "boolean") patch.alerts = body.alerts;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "NOTHING TO CHANGE" }, { status: 400 });
    }

    await updateAccountAlerts(me.accountId, patch);
    const account = await findAccountById(me.accountId);
    return NextResponse.json({ email: account?.email ?? "", alerts: account?.alerts ?? false });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg === "EMAIL ALREADY IN USE") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return storeError(e);
  }
}
