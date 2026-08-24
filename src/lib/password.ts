import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * scrypt from the standard library — no dependency, and deliberately slow.
 * Stored as `scrypt$N$r$p$salt$hash`, so the parameters travel with the hash
 * and can be raised later without invalidating existing accounts.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const expected = Buffer.from(hash, "base64url");
    const actual = scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Usernames are case-insensitive and stored as typed for display. */
export function normaliseUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 20);
}

export function usernameKey(raw: string): string {
  return normaliseUsername(raw).toLowerCase();
}

export interface CredentialProblem {
  field: "username" | "password";
  message: string;
}

export function validateCredentials(username: string, password: string): CredentialProblem | null {
  const u = normaliseUsername(username);
  if (u.length < 3) return { field: "username", message: "USERNAME NEEDS 3+ CHARACTERS" };
  if (!/^[A-Za-z0-9_. -]+$/.test(u)) {
    return { field: "username", message: "LETTERS, NUMBERS, . _ - ONLY" };
  }
  if (password.length < 8) return { field: "password", message: "PASSWORD NEEDS 8+ CHARACTERS" };
  if (password.length > 200) return { field: "password", message: "PASSWORD TOO LONG" };
  return null;
}
