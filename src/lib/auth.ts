import { getSession } from "./session";
import { findAccountById } from "./store";
import type { Role } from "./types";

/**
 * Who is making this request, according to the database.
 *
 * The session cookie is HMAC-signed and lives for 30 days, which means the role
 * baked into it goes stale the moment an admin promotes or demotes someone —
 * and a deleted account would keep working until its cookie expired. So every
 * request re-reads the account row and trusts that, never the cookie's claim.
 * The cookie is only used to say *which* account is asking.
 */
export interface Viewer {
  accountId: string;
  username: string;
  role: Role;
}

export async function viewer(): Promise<Viewer | null> {
  const session = await getSession();
  if (!session) return null;
  const account = await findAccountById(session.accountId);
  if (!account) return null; // deleted account — signed out on its next request
  return { accountId: account.id, username: account.username, role: account.role };
}

export async function adminViewer(): Promise<Viewer | null> {
  const v = await viewer();
  return v && v.role === "admin" ? v : null;
}

/**
 * For server components, where a store outage should send you to the gate
 * rather than render Next's error page.
 */
export async function viewerOrNull(): Promise<Viewer | null> {
  try {
    return await viewer();
  } catch {
    return null;
  }
}
