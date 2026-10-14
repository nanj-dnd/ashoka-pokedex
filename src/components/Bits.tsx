"use client";

import { useEffect, useState } from "react";
import { useDex } from "@/lib/DexContext";
import { sfxEnabled, toggleSfx, sfx } from "@/lib/client";
import { MAX_ZOOM } from "@/lib/pixelate";
import type { Stats } from "@/lib/types";

export function TypeChip({ type, outline }: { type: string; outline?: boolean }) {
  const { typeColor } = useDex();
  return (
    <span
      className={`chip${outline ? " outline" : ""}`}
      style={{ ["--chip-color" as string]: typeColor(type) }}
    >
      {type}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: string }) {
  const { config, rarity: tierFor } = useDex();
  const tier = tierFor(rarity);
  // The top rung gets the shimmer, whatever this dex decided to call it.
  const isTop = config.rarities[config.rarities.length - 1]?.label === tier.label;
  return (
    <span
      className={`rarity${isTop ? " mythic" : ""}`}
      style={{
        ["--rar-ink" as string]: tier.color,
        // Derived rather than configured: one colour per tier is enough for an
        // owner to think about, and the glow is always the same colour softened.
        ["--rar-glow" as string]: `${tier.color}88`,
      }}
    >
      {tier.label}
    </span>
  );
}

/** Six chunky pixel bars — the card's stat block. */
export function StatBars({ stats, color }: { stats: Stats; color: string }) {
  const { config } = useDex();
  return (
    <div>
      {config.stats.map(({ key, label }) => {
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

/**
 * Framing control for a capture. Zoom is a centre crop of the frame, so it can
 * be moved as often as you like without ever degrading the original.
 */
export function ZoomSlider({
  value,
  onChange,
  ink,
}: {
  value: number;
  onChange: (v: number) => void;
  ink: string;
}) {
  return (
    <div className="zoom-row">
      <span className="stat-name">ZOOM</span>
      <input
        className="slider"
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Zoom"
        style={{ ["--bar-c" as string]: ink }}
      />
      <span className="stat-val">{value.toFixed(1)}×</span>
      <button
        className="ghost"
        style={{ fontSize: 8, flex: "0 0 auto", padding: "6px 8px" }}
        onClick={() => { sfx.move(); onChange(1); }}
        disabled={value === 1}
      >
        1×
      </button>
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
