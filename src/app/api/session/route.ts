import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE, newSession } from "@/lib/session";
import { viewer } from "@/lib/auth";
import { createAccount, findAccountByUsername } from "@/lib/store";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "@/lib/password";
import { storeError } from "@/lib/apiError";
import type { Account } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withSession(account: Account) {
  const res = NextResponse.json({
    account: { id: account.id, username: account.username },
  });
  res.cookies.set(SESSION_COOKIE, newSession(account.id, account.username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** GET — who am I? */
export async function GET() {
  try {
    const v = await viewer();
    return NextResponse.json({ account: v ? { id: v.accountId, username: v.username } : null });
  } catch {
    // A store outage shouldn't look like being signed out forever, but there is
    // nothing useful to say here either; the UI treats null as "signed out".
    return NextResponse.json({ account: null });
  }
}

/**
 * POST — { action: "signin" | "signup", username, password }
 *
 * Signing up no longer needs a code. Anyone can hold an account; a code is
 * what gets you into a particular dex, and that happens at /api/d/<slug>/join.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "signup" ? "signup" : "signin";
  const username = normaliseUsername(typeof body.username === "string" ? body.username : "");
  const password = typeof body.password === "string" ? body.password : "";

  try {
    if (action === "signup") {
      const problem = validateCredentials(username, password);
      if (problem) return NextResponse.json({ error: problem.message }, { status: 400 });

      if (await findAccountByUsername(username)) {
        return NextResponse.json({ error: "USERNAME TAKEN" }, { status: 409 });
      }

      const account: Account = {
        id: randomUUID(),
        username,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        email: "",
        alerts: true,
      };
      return withSession(await createAccount(account));
    }

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
    if (msg === "USERNAME TAKEN") {
      return NextResponse.json({ error: "USERNAME TAKEN" }, { status: 409 });
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
