import type { CreatureType, Rarity, StatKey } from "./constants";

export type Role = "admin" | "public";

export type CreatureStatus = "pending" | "approved" | "rejected";

export type Stats = Record<StatKey, number>;

export interface Vote {
  handle: string;
  vote: "approve" | "reject";
  at: string;
}

export interface Creature {
  id: string;
  /** Assigned at approval time, so the public dex numbers run 001, 002, ... */
  dexNumber: number | null;
  name: string;
  /** Short subtitle, e.g. "The Mess Hall Prophet". */
  title: string;
  types: CreatureType[];
  rarity: Rarity;
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
  votes: Vote[];
  createdAt: string;
  approvedAt: string | null;
}

/** What the public dex is allowed to know. Strips submitter + vote history. */
export type PublicCreature = Omit<Creature, "votes" | "submittedBy" | "status"> & {
  seenCount: number;
};

export interface SessionPayload {
  role: Role;
  handle: string;
  exp: number;
}

// Re-exported so callers can pull the whole vocabulary from one module.
export type { CreatureType, Rarity, StatKey } from "./constants";
