"use client";

import { useEffect, useState } from "react";
import { RARITY_STYLE, STATS, TYPE_COLOR, type CreatureType, type Rarity } from "@/lib/constants";
import { sfxEnabled, toggleSfx, sfx } from "@/lib/client";
import type { Stats } from "@/lib/types";

export function TypeChip({ type, outline }: { type: CreatureType; outline?: boolean }) {
  return (
    <span
      className={`chip${outline ? " outline" : ""}`}
      style={{ ["--chip-color" as string]: TYPE_COLOR[type] ?? "#8b9bb4" }}
    >
      {type}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const s = RARITY_STYLE[rarity] ?? RARITY_STYLE.COMMON;
  return (
    <span
      className={`rarity${rarity === "MYTHIC" ? " mythic" : ""}`}
      style={{ ["--rar-ink" as string]: s.ink, ["--rar-glow" as string]: s.glow }}
    >
      {s.label}
    </span>
  );
}

/** Six chunky pixel bars — the card's stat block. */
export function StatBars({ stats, color }: { stats: Stats; color: string }) {
  return (
    <div>
      {STATS.map(({ key, label }) => {
        const v = Math.max(0, Math.min(100, Number(stats?.[key] ?? 0)));
        return (
          <div className="stat-row" key={key}>
            <span className="stat-name">{label}</span>
            <div className="bar">
              <div
                className="bar-fill"
                style={{ width: `${v}%`, ["--bar-c" as string]: color }}
              />
            </div>
            <span className="stat-val">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Approval progress: filled pips = votes in, empty = still needed. */
export function Pips({ have, need }: { have: number; need: number }) {
  return (
    <div className="pips" title={`${have} of ${need}`}>
      {Array.from({ length: need }, (_, i) => (
        <i key={i} className={`pip${i < have ? " on" : ""}`} />
      ))}
    </div>
  );
}

export function SfxToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sfxEnabled()), []);
  return (
    <button
      className="ghost"
      style={{ fontSize: 8, padding: "8px 10px" }}
      onClick={() => {
        const next = toggleSfx();
        setOn(next);
        if (next) sfx.select();
      }}
    >
      SFX {on ? "ON" : "OFF"}
    </button>
  );
}

/** Big progress readout at the top of the public dex. */
export function DexProgress({ seen, total }: { seen: number; total: number }) {
  const pct = total ? (seen / total) * 100 : 0;
  return (
    <div className="progress">
      <span className="label">SEEN</span>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%`, ["--bar-c" as string]: "var(--lime)" }} />
      </div>
      <span className="stat-val" style={{ width: 56 }}>
        {seen}/{total}
      </span>
    </div>
  );
}
