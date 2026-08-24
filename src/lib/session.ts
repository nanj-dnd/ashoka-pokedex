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
    return payload;
  } catch {
    return null;
  }
}

export function newSession(role: Role, handle: string): string {
  return encodeSession({ role, handle, exp: Date.now() + SESSION_TTL_MS });
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
 * Codes are compared server-side only; they never reach the client bundle.
 * Both are checked every time so the response time does not leak which
 * code was closer to correct.
 */
export function roleForCode(code: string): Role | null {
  const adminCode = process.env.ADMIN_CODE ?? "1205";
  const publicCode = process.env.PUBLIC_CODE ?? "1201";
  const trimmed = code.trim();
  const isAdmin = safeEqual(trimmed.padEnd(32, "\0").slice(0, 32), adminCode.padEnd(32, "\0").slice(0, 32));
  const isPublic = safeEqual(trimmed.padEnd(32, "\0").slice(0, 32), publicCode.padEnd(32, "\0").slice(0, 32));
  if (isAdmin) return "admin";
  if (isPublic) return "public";
  return null;
}

export function requiredApprovals(): number {
  const n = Number(process.env.REQUIRED_APPROVALS ?? 2);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export { randomUUID };
