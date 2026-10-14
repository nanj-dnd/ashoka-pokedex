import { getSession } from "./session";
import { findAccountById, getDexBySlug, getMembership } from "./store";
import { canAdmin, type Dex, type MemberRole } from "./types";

/**
 * Who is making this request, according to the database.
 *
 * The session cookie is HMAC-signed and lives for 30 days, so anything baked
 * into it goes stale — a deleted account would keep working until its cookie
 * expired. Every request re-reads the account row and trusts that; the cookie
 * only says *which* account is asking.
 */
export interface Viewer {
  accountId: string;
  username: string;
}

export async function viewer(): Promise<Viewer | null> {
  const session = await getSession();
  if (!session) return null;
  const account = await findAccountById(session.accountId);
  if (!account) return null; // deleted account — signed out on its next request
  return { accountId: account.id, username: account.username };
}

/**
 * A viewer in the context of one dex. `role` is null when they are signed in
 * but have not joined — which is a real, common state: it is what someone sees
 * before they enter a join code.
 *
 * Membership is re-read per request for the same reason as the account row, so
 * removing someone or changing their role takes effect immediately.
 */
export interface DexViewer extends Viewer {
  dex: Dex;
  role: MemberRole | null;
}

export async function dexViewer(slug: string): Promise<DexViewer | null> {
  const [v, dex] = await Promise.all([viewer(), getDexBySlug(slug)]);
  if (!v || !dex) return null;
  const membership = await getMembership(dex.id, v.accountId);
  return { ...v, dex, role: membership?.role ?? null };
}

/** Signed in, joined, and able to capture or vote. */
export async function dexAdmin(slug: string): Promise<DexViewer | null> {
  const dv = await dexViewer(slug);
  return dv && canAdmin(dv.role) ? dv : null;
}

/** Signed in and joined, at any role. */
export async function dexMember(slug: string): Promise<DexViewer | null> {
  const dv = await dexViewer(slug);
  return dv && dv.role ? dv : null;
}

/** Only the owner may rewrite the config or delete the dex. */
export async function dexOwner(slug: string): Promise<DexViewer | null> {
  const dv = await dexViewer(slug);
  return dv && dv.role === "owner" ? dv : null;
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

export async function dexViewerOrNull(slug: string): Promise<DexViewer | null> {
  try {
    return await dexViewer(slug);
  } catch {
    return null;
  }
}
