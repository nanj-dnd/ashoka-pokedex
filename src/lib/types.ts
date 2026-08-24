import type { CreatureType, StatKey } from "./constants";
import type { RarityStanding } from "./rarity";

export type Role = "admin" | "public";

export type CreatureStatus = "pending" | "approved" | "rejected";

export type Stats = Record<StatKey, number>;

export interface Vote {
  username: string;
  vote: "approve" | "reject";
  at: string;
  /** Set when an admin overrode the threshold instead of waiting for a quorum. */
  forced?: boolean;
}

export interface Creature {
  id: string;
  /** Assigned at approval time, so the public dex numbers run 001, 002, ... */
  dexNumber: number | null;
  name: string;
  /** Short subtitle, e.g. "The Mess Hall Prophet". */
  title: string;
  types: CreatureType[];
  habitat: string;
  batch: string;
  /** Free-form trait chips. */
  characteristics: string[];
  /** Pokedex flavour paragraph. */
  entry: string;
  quote: string;
  stats: Stats;
  spriteUrl: string;
  photoUrl: string;
  status: CreatureStatus;
  submittedBy: string;
  /** Whether the submission came in through the admin capture flow or a trainer nomination. */
  submittedByRole: Role;
  votes: Vote[];
  createdAt: string;
  approvedAt: string | null;
  /** Last admin edit, or null if untouched since capture. */
  updatedAt: string | null;
}

/**
 * What the public dex is allowed to know. Strips the vote history and the
 * submitter's role, keeps the submitter as a visible "caught by" credit, and
 * adds the earned rarity standing, which is computed at read time rather than
 * stored — see lib/rarity.ts.
 */
export type PublicCreature = Omit<
  Creature,
  "votes" | "submittedBy" | "submittedByRole" | "status"
> &
  RarityStanding & { caughtBy: string };

/** A trainer's own submission, as shown back to them. No vote authors. */
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
  role: Role;
  joinedAt: string;
  /** Approved entries this trainer has marked seen. */
  seen: number;
  /** Entries they put into the queue, and how many made it in. */
  nominations: number;
  approved: number;
}

export interface Account {
  id: string;
  username: string;
  /** scrypt hash — never leaves the server. */
  passwordHash: string;
  role: Role;
  createdAt: string;
}

/** What the client is allowed to know about the signed-in account. */
export interface PublicAccount {
  id: string;
  username: string;
  role: Role;
}

export interface SessionPayload {
  accountId: string;
  username: string;
  role: Role;
  exp: number;
}

// Re-exported so callers can pull the whole vocabulary from one module.
export type { CreatureType, Rarity, StatKey } from "./constants";
export type { RarityStanding } from "./rarity";
