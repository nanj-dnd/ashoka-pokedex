"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DexConfig, MemberRole, RarityTier, TypeDef } from "./types";
import { canAdmin } from "./types";

/**
 * The active dex, handed down once at the top of a page.
 *
 * Components used to import TYPES / STATS / RARITY_STYLE straight from
 * constants, which is exactly what made the app single-tenant. They now ask
 * this context, so the same component renders one community's vocabulary on one
 * route and a completely different one on the next.
 */
export interface DexContextValue {
  slug: string;
  name: string;
  tagline: string;
  config: DexConfig;
  /** null when signed in but not a member of this dex. */
  role: MemberRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  username: string;

  /** Colour for a type label; grey for a label the config no longer knows. */
  typeColor(label: string): string;
  typeHint(label: string): string;
  /** Tier by label, falling back to the bottom rung. */
  rarity(label: string): RarityTier;
}

const Ctx = createContext<DexContextValue | null>(null);

export function DexProvider({
  slug,
  name,
  tagline,
  config,
  role,
  username,
  children,
}: {
  slug: string;
  name: string;
  tagline: string;
  config: DexConfig;
  role: MemberRole | null;
  username: string;
  children: ReactNode;
}) {
  const value = useMemo<DexContextValue>(() => {
    const types = new Map<string, TypeDef>(config.types.map((t) => [t.label, t]));
    const rarities = new Map<string, RarityTier>(config.rarities.map((r) => [r.label, r]));
    // A config edit can orphan labels already stored on entries, so every
    // lookup has to survive a miss rather than render undefined.
    const floor = config.rarities[0];

    return {
      slug,
      name,
      tagline,
      config,
      role,
      isAdmin: canAdmin(role),
      isOwner: role === "owner",
      username,
      typeColor: (label) => types.get(label)?.color ?? "#8b9bb4",
      typeHint: (label) => types.get(label)?.hint ?? "",
      rarity: (label) => rarities.get(label) ?? floor,
    };
  }, [slug, name, tagline, config, role, username]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDex(): DexContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDex must be used inside a DexProvider");
  return v;
}
