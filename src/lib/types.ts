import type { DexConfig } from "./dexConfig";
import type { RarityStanding } from "./rarity";

/**
 * Roles belong to a MEMBERSHIP, not to an account. The same person can own one
 * dex, help run a second and merely browse a third, so there is no such thing
 * as "an admin" globally — only an admin *of something*.
 */
export type MemberRole = "owner" | "admin" | "member";

/** Owners are admins with extra rights; most checks only care about this. */
export function canAdmin(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export type CreatureStatus = "pending" | "approved" | "rejected";

/** Stat keys are defined by each dex's config, so this cannot be a union. */
export type Stats = Record<string, number>;

export interface Vote {
  username: string;
  vote: "approve" | "reject";
  at: string;
  /** Set when an admin overrode the threshold instead of waiting for a quorum. */
  forced?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Dex                                                                        */
/* -------------------------------------------------------------------------- */

export interface Dex {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  ownerId: string;
  config: DexConfig;
  adminCode: string;
  memberCode: string;
  listed: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** A dex as shown to someone who has not joined it — no codes. */
export type PublicDex = Omit<Dex, "adminCode" | "memberCode" | "ownerId">;

/** A dex in someone's own list, with their standing in it. */
export interface DexSummary {
  slug: string;
  name: string;
  tagline: string;
  role: MemberRole;
  entries: number;
  members: number;
  joinedAt: string;
}

export interface Membership {
  dexId: string;
  accountId: string;
  role: MemberRole;
  joinedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Creatures                                                                  */
/* -------------------------------------------------------------------------- */

export interface Creature {
  id: string;
  dexId: string;
  /** Assigned at approval. Unique per dex — every dex starts at 001. */
  dexNumber: number | null;
  name: string;
  /** Short subtitle, e.g. "The Mess Hall Prophet". */
  title: string;
  /** Labels drawn from the dex config; free strings as far as storage cares. */
  types: string[];
  habitat: string;
  /** Whatever the owner called their cohort field — batch, team, company. */
  cohort: string;
  /** Free-form trait chips. */
  characteristics: string[];
  /** Dex flavour paragraph. */
  entry: string;
  quote: string;
  stats: Stats;
  spriteUrl: string;
  photoUrl: string;
  status: CreatureStatus;
  submittedBy: string;
  /** Whether this came in through admin capture or a member nomination. */
  submittedByRole: "admin" | "member";
  votes: Vote[];
  createdAt: string;
  approvedAt: string | null;
  /** Last admin edit, or null if untouched since capture. */
  updatedAt: string | null;
  /**
   * The highest rarity this entry has already been announced at. Rarity is
   * computed at read time and moves with every sighting, so this is what stops
   * an entry being re-announced on each recount. Set at approval, then climbs.
   */
  notifiedRarity: string | null;
}

/**
 * What the dex is allowed to show. Strips the vote history and the submitter's
 * role, keeps the submitter as a visible "caught by" credit, and adds the
 * earned rarity standing, computed at read time rather than stored.
 */
export type PublicCreature = Omit<
  Creature,
  "votes" | "submittedBy" | "submittedByRole" | "status" | "dexId"
> &
  RarityStanding & { caughtBy: string };

/** A member's own submission, as shown back to them. No vote authors. */
export interface MyNomination {
  id: string;
  name: string;
  spriteUrl: string;
  status: CreatureStatus;
  dexNumber: number | null;
  createdAt: string;
  approvals: number;
  rejections: number;
  needed: number;
}

/** One row of the hall of fame. */
export interface TrainerStanding {
  id: string;
  username: string;
  role: MemberRole;
  joinedAt: string;
  /** Approved entries this member has marked seen. */
  seen: number;
  /** Entries they put into the queue, and how many made it in. */
  nominations: number;
  approved: number;
}

/* -------------------------------------------------------------------------- */
/*  Accounts                                                                   */
/* -------------------------------------------------------------------------- */

export interface Account {
  id: string;
  username: string;
  /** scrypt hash — never leaves the server. */
  passwordHash: string;
  createdAt: string;
  /** Optional; empty until someone opts in to alerts. */
  email: string;
  /** Kept separate from the address, so unsubscribing doesn't discard it. */
  alerts: boolean;
}

/** What the client is allowed to know about the signed-in account. */
export interface PublicAccount {
  id: string;
  username: string;
}

/**
 * The session identifies a person, not a role. Authority is looked up per dex
 * on each request, so promoting or removing someone takes effect immediately
 * instead of waiting for their cookie to expire.
 */
export interface SessionPayload {
  accountId: string;
  username: string;
  exp: number;
}

export type { DexConfig, RarityTier, StatDef, TypeDef } from "./dexConfig";
export type { RarityStanding } from "./rarity";
