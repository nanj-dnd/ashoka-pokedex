import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE, newSession, roleForCode } from "@/lib/session";
import { viewer } from "@/lib/auth";
import { createAccount, findAccountByUsername } from "@/lib/store";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "@/lib/password";
import { storeError } from "@/lib/apiError";
import { isValidEmail, normaliseEmail } from "@/lib/mail";
import type { Account } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withSession(account: Account) {
  const res = NextResponse.json({
    account: { id: account.id, username: account.username, role: account.role },
  });
  res.cookies.set(SESSION_COOKIE, newSession(account.id, account.username, account.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** GET — who am I? Answered from the account row, so a role change shows up. */
export async function GET() {
  try {
    const me = await viewer();
    if (!me) return NextResponse.json({ account: null });
    return NextResponse.json({
      account: { id: me.accountId, username: me.username, role: me.role },
    });
  } catch (e) {
    return storeError(e);
  }
}

/**
 * POST — { action: "signin" | "signup", username, password, code? }
 *
 * Sign-up requires an access code; the code determines the role. Sign-in needs
 * only the username and password — the code is an invitation, not a login.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "signup" ? "signup" : "signin";
  const rawUsername = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const username = normaliseUsername(rawUsername);
  // Optional at sign-up. It exists only to send dex alerts, so no address
  // means no mail rather than a blocked account.
  const email = normaliseEmail(body.email);

  try {
    if (action === "signup") {
      const code = typeof body.code === "string" ? body.code : "";
      const role = roleForCode(code);
      if (!role) return NextResponse.json({ error: "INVALID ACCESS CODE" }, { status: 401 });

      const problem = validateCredentials(username, password);
      if (problem) return NextResponse.json({ error: problem.message }, { status: 400 });

      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: "THAT EMAIL DOES NOT LOOK RIGHT" }, { status: 400 });
      }

      if (await findAccountByUsername(username)) {
        return NextResponse.json({ error: "USERNAME TAKEN" }, { status: 409 });
      }

      const account: Account = {
        id: randomUUID(),
        username,
        passwordHash: hashPassword(password),
        role,
        createdAt: new Date().toISOString(),
        email,
        alerts: true,
      };
      return withSession(await createAccount(account));
    }

    // --- sign in ---
    if (!username || !password) {
      return NextResponse.json({ error: "ENTER USERNAME AND PASSWORD" }, { status: 400 });
    }

    const account = await findAccountByUsername(username);
    // Same message either way, so this can't be used to enumerate usernames.
    if (!account || !verifyPassword(password, account.passwordHash)) {
      return NextResponse.json({ error: "WRONG USERNAME OR PASSWORD" }, { status: 401 });
    }
    return withSession(account);
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg === "USERNAME TAKEN" || msg === "EMAIL ALREADY IN USE") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return storeError(e);
  }
}

/** DELETE — sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
