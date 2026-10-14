import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Dex, MemberRole, SessionPayload } from "./types";

export const SESSION_COOKIE = "dex_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Dev fallback so `npm run dev` works before .env.local exists.
    // Production sets a real SESSION_SECRET.
    return "dex-development-only-secret-do-not-ship";
  }
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.accountId !== "string" || !payload.accountId) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * The session says who you are and nothing else. Roles are per-dex and looked
 * up on every request, so removing someone from a dex takes effect at once
 * rather than whenever their cookie happens to expire.
 */
export function newSession(accountId: string, username: string): string {
  return encodeSession({ accountId, username, exp: Date.now() + SESSION_TTL_MS });
}

/** Read the current session inside a server component or route handler. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

/* -------------------------------------------------------------------------- */
/*  Join codes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A dex's codes decide who may JOIN it and as what. They are not a login —
 * once you are a member, authority comes from the membership row, so changing
 * a code locks out future joiners without touching anyone already inside.
 *
 * Codes live on the dex row rather than in the environment, because every dex
 * on the deployment has its own.
 */
export function roleForDexCode(dex: Dex, code: string): MemberRole | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const pad = (v: string) => v.padEnd(32, "\0").slice(0, 32);
  const admin = dex.adminCode?.trim();
  const member = dex.memberCode?.trim();

  // Checked in this order, so an owner who sets both codes the same gets a dex
  // full of admins. createDex refuses that, but a hand-edited row could do it.
  if (admin && safeEqual(pad(trimmed), pad(admin))) return "admin";
  if (member && safeEqual(pad(trimmed), pad(member))) return "member";
  return null;
}

/** Four digits, avoiding codes that read as a year or are trivially guessable. */
export function generateCode(): string {
  const bad = new Set(["0000", "1111", "1234", "4321", "9999", "1212", "0123"]);
  for (;;) {
    const n = Math.floor(Math.random() * 10000);
    const code = String(n).padStart(4, "0");
    if (!bad.has(code)) return code;
  }
}

/* -------------------------------------------------------------------------- */
/*  Unsubscribe links                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A one-click unsubscribe token. Signed with the same secret as sessions, but
 * it is not a session: all it can ever do is turn one account's alerts off, so
 * a leaked link out of someone's inbox costs them nothing but the mail.
 */
export function alertToken(accountId: string): string {
  return `${accountId}.${sign(`alerts:${accountId}`)}`;
}

export function readAlertToken(token: string | null): string | null {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const accountId = token.slice(0, cut);
  const signature = token.slice(cut + 1);
  return safeEqual(signature, sign(`alerts:${accountId}`)) ? accountId : null;
}

export { randomUUID };
