"use client";

import { useEffect, useState } from "react";
import { RARITY_STYLE } from "@/lib/constants";
import { sfx } from "@/lib/client";
import { RarityBadge, StatBars, TypeChip } from "./Bits";
import type { PublicCreature } from "@/lib/types";

export function CreatureDetail({
  creature,
  seen,
  onToggleSeen,
  onClose,
}: {
  creature: PublicCreature;
  seen?: boolean;
  onToggleSeen?: () => void;
  onClose: () => void;
}) {
  // Sprite by default; the real photo is the reward for opening the entry.
  const [showPhoto, setShowPhoto] = useState(false);
  const ink = (RARITY_STYLE[creature.rarity] ?? RARITY_STYLE.COMMON).ink;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const num = creature.dexNumber ? String(creature.dexNumber).padStart(3, "0") : "???";

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <h2 style={{ color: ink }}>
            No.{num} {creature.name}
          </h2>
          <button className="ghost" onClick={onClose}>
            CLOSE X
          </button>
        </div>

        <div className="detail">
          <div>
            <img
              className="detail-sprite"
              src={showPhoto && creature.photoUrl ? creature.photoUrl : creature.spriteUrl}
              alt={creature.name}
              style={{ boxShadow: `0 0 0 4px ${ink}, 0 0 24px ${ink}55` }}
            />
            {creature.photoUrl ? (
              <button
                style={{ width: "100%", marginTop: 12, fontSize: 8 }}
                onClick={() => {
                  sfx.select();
                  setShowPhoto((v) => !v);
                }}
              >
                {showPhoto ? "VIEW SPRITE" : "VIEW PHOTO"}
              </button>
            ) : null}

            {onToggleSeen ? (
              <button
                className={seen ? "go" : "primary"}
                style={{ width: "100%", marginTop: 8, fontSize: 8 }}
                onClick={() => {
                  seen ? sfx.move() : sfx.good();
                  onToggleSeen();
                }}
              >
                {seen ? "✓ SEEN" : "MARK AS SEEN"}
              </button>
            ) : null}

            <div className="label center" style={{ marginTop: 10 }}>
              {creature.seenCount} TRAINER{creature.seenCount === 1 ? "" : "S"} SPOTTED
            </div>
          </div>

          <div>
            <div className="plate">
              <div className="chip-row" style={{ marginBottom: 10 }}>
                <RarityBadge rarity={creature.rarity} />
                {creature.types.map((t) => (
                  <TypeChip key={t} type={t} />
                ))}
              </div>
              {creature.title ? (
                <div className="body-text" style={{ color: ink }}>
                  {creature.title}
                </div>
              ) : null}
            </div>

            <div className="plate">
              <div className="kv">
                <span className="label">HABITAT</span>
                <span className="body-text">{creature.habitat || "UNKNOWN"}</span>
                <span className="label">BATCH</span>
                <span className="body-text">{creature.batch || "UNKNOWN"}</span>
              </div>
            </div>

            {creature.characteristics.length ? (
              <div className="plate">
                <div className="label" style={{ marginBottom: 8 }}>
                  CHARACTERISTICS
                </div>
                <div className="chip-row">
                  {creature.characteristics.map((c) => (
                    <span key={c} className="chip outline" style={{ ["--chip-color" as string]: ink }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {creature.entry ? (
              <div className="plate">
                <div className="label" style={{ marginBottom: 8 }}>
                  DEX ENTRY
                </div>
                <p className="body-text" style={{ margin: 0 }}>
                  {creature.entry}
                </p>
              </div>
            ) : null}

            {creature.quote ? (
              <div className="plate">
                <div className="quote">&ldquo;{creature.quote}&rdquo;</div>
              </div>
            ) : null}

            <div className="plate">
              <div className="label" style={{ marginBottom: 10 }}>
                BASE STATS
              </div>
              <StatBars stats={creature.stats} color={ink} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
