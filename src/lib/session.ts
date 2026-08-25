import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Role, SessionPayload } from "./types";

export const SESSION_COOKIE = "dex_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Dev fallback so `npm run dev` works before .env.local exists.
    // Production sets a real SESSION_SECRET.
    return "ashoka-pokedex-development-only-secret-do-not-ship";
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
    if (payload.role !== "admin" && payload.role !== "public") return null;
    if (typeof payload.accountId !== "string" || !payload.accountId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSession(accountId: string, username: string, role: Role): string {
  return encodeSession({ accountId, username, role, exp: Date.now() + SESSION_TTL_MS });
}

/** Read the current session inside a server component or route handler. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireRole(role: Role): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  // Admins can do anything the public can.
  if (role === "public") return session;
  return session.role === "admin" ? session : null;
}

/**
 * The access code is no longer a login — it is the invitation that lets someone
 * CREATE an account, and it decides whether that account is an admin or a
 * trainer. After sign-up people use a username and password.
 *
 * Codes are compared server-side only; they never reach the client bundle.
 * There are deliberately NO fallback values here. This repo is public, so a
 * hardcoded default would just be the door code published on the internet.
 */
export function roleForCode(code: string): Role | null {
  const adminCode = process.env.ADMIN_CODE?.trim();
  const publicCode = process.env.PUBLIC_CODE?.trim();
  if (!adminCode && !publicCode) return null;
  const trimmed = code.trim();
  const pad = (v: string) => v.padEnd(32, "\0").slice(0, 32);
  const isAdmin = Boolean(adminCode) && safeEqual(pad(trimmed), pad(adminCode!));
  const isPublic = Boolean(publicCode) && safeEqual(pad(trimmed), pad(publicCode!));
  if (isAdmin) return "admin";
  if (isPublic) return "public";
  return null;
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

export function requiredApprovals(): number {
  const n = Number(process.env.REQUIRED_APPROVALS ?? 2);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export { randomUUID };
