"use client";

import { useEffect, useMemo, useState } from "react";
import { RARITY_STYLE } from "@/lib/constants";
import { api, sfx } from "@/lib/client";
import { RarityBadge } from "./Bits";
import type { PublicCreature, TrainerStanding } from "@/lib/types";

/** "24 AUG 2026" — short, uppercase, and locale-independent. */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The hall of fame: who has filled in the most of the dex, and who campus has
 * seen the most. Everything here is aggregate — the board says how many entries
 * a trainer has ticked off, never which ones.
 */
export function HallOfFame({
  creatures,
  username,
  onOpenCreature,
}: {
  creatures: PublicCreature[];
  username: string;
  onOpenCreature: (c: PublicCreature) => void;
}) {
  const [trainers, setTrainers] = useState<TrainerStanding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<TrainerStanding | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ trainers: TrainerStanding[]; totalApproved: number }>(
          "/api/leaderboard",
        );
        setTrainers(res.trainers);
        setTotal(res.totalApproved);
      } catch (e) {
        setError(String((e as Error).message).toUpperCase());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Most-wanted is just the dex re-sorted by notoriety, so it needs no fetch.
  const mostWanted = useMemo(
    () => [...creatures].sort((a, b) => b.seenCount - a.seenCount || a.name.localeCompare(b.name)).slice(0, 10),
    [creatures],
  );

  if (loading) return <div className="empty"><span className="label blink">TALLYING</span></div>;
  if (error) return <div className="empty"><span className="err">{error}</span></div>;

  return (
    <div className="stack">
      {/* ---------------------------- most wanted --------------------------- */}
      <div className="plate">
        <div className="label" style={{ marginBottom: 12 }}>
          MOST WANTED — WHO CAMPUS HAS ACTUALLY SEEN
        </div>
        {!mostWanted.length ? (
          <div className="body-text dim">Nothing in the dex yet.</div>
        ) : (
          <div className="board">
            {mostWanted.map((c, i) => {
              const ink = (RARITY_STYLE[c.rarity] ?? RARITY_STYLE.UNCOMMON).ink;
              return (
                <div
                  className="board-row"
                  key={c.id}
                  onClick={() => { sfx.open(); onOpenCreature(c); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCreature(c); } }}
                >
                  <span className={`rank${i < 3 ? " top" : ""}`}>{i + 1}</span>
                  <img className="board-sprite" src={c.spriteUrl} alt={c.name} loading="lazy" />
                  <div style={{ minWidth: 0 }}>
                    <div className="board-name" style={{ color: ink }}>{c.name}</div>
                    <div className="label">
                      {c.seenCount} SIGHTING{c.seenCount === 1 ? "" : "S"}
                      {c.caughtBy ? ` · CAUGHT BY ${c.caughtBy.toUpperCase()}` : ""}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto" }}><RarityBadge rarity={c.rarity} /></span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------ trainers ---------------------------- */}
      <div className="plate">
        <div className="label" style={{ marginBottom: 12 }}>
          TRAINERS — DEX COMPLETION
        </div>
        <div className="board">
          {trainers.map((t, i) => {
            const pct = total ? (t.seen / total) * 100 : 0;
            const me = t.username.toLowerCase() === username.toLowerCase();
            return (
              <div
                className={`board-row${me ? " me" : ""}`}
                key={t.id}
                onClick={() => { sfx.open(); setProfile(t); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProfile(t); } }}
              >
                <span className={`rank${i < 3 ? " top" : ""}`}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="board-name">
                    {t.username}
                    {t.role === "admin" ? <span className="tag admin">ADMIN</span> : null}
                    {me ? <span className="tag you">YOU</span> : null}
                  </div>
                  <div className="bar" style={{ marginTop: 6 }}>
                    <div
                      className="bar-fill"
                      style={{ width: `${pct}%`, ["--bar-c" as string]: me ? "var(--amber)" : "var(--lime)" }}
                    />
                  </div>
                </div>
                <span className="stat-val" style={{ width: 62 }}>
                  {t.seen}/{total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {profile ? (
        <TrainerCard
          trainer={profile}
          total={total}
          rank={trainers.findIndex((t) => t.id === profile.id) + 1}
          caught={creatures.filter(
            (c) => c.caughtBy.toLowerCase() === profile.username.toLowerCase(),
          )}
          onOpenCreature={onOpenCreature}
          onClose={() => setProfile(null)}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trainer profile                                                            */
/* -------------------------------------------------------------------------- */

function TrainerCard({
  trainer,
  total,
  rank,
  caught,
  onOpenCreature,
  onClose,
}: {
  trainer: TrainerStanding;
  total: number;
  rank: number;
  caught: PublicCreature[];
  onOpenCreature: (c: PublicCreature) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pct = total ? Math.round((trainer.seen / total) * 100) : 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <h2 style={{ color: "var(--amber)" }}>{trainer.username}</h2>
          <button className="ghost" onClick={onClose}>CLOSE X</button>
        </div>

        <div className="plate">
          <div className="kv">
            <span className="label">RANK</span>
            <span className="body-text">#{rank}</span>
            <span className="label">ROLE</span>
            <span className="body-text">{trainer.role === "admin" ? "ADMIN" : "TRAINER"}</span>
            <span className="label">JOINED</span>
            <span className="body-text">{shortDate(trainer.joinedAt)}</span>
          </div>
        </div>

        <div className="plate">
          <div className="label" style={{ marginBottom: 8 }}>DEX COMPLETION</div>
          <div className="body-text">{trainer.seen} of {total} · {pct}%</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div
              className="bar-fill"
              style={{ width: `${pct}%`, ["--bar-c" as string]: "var(--lime)" }}
            />
          </div>
        </div>

        <div className="plate">
          <div className="label" style={{ marginBottom: 8 }}>CONTRIBUTIONS</div>
          <div className="body-text">
            {trainer.nominations} submitted · {trainer.approved} in the dex
          </div>
          {caught.length ? (
            <div className="chip-row" style={{ marginTop: 10 }}>
              {caught.map((c) => (
                <span
                  key={c.id}
                  onClick={() => { onClose(); onOpenCreature(c); }}
                  style={{ cursor: "pointer" }}
                >
                  <span className="chip outline" style={{ ["--chip-color" as string]: "var(--cyan)" }}>
                    No.{String(c.dexNumber ?? 0).padStart(3, "0")} {c.name}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div className="body-text dim" style={{ marginTop: 6 }}>
              Nothing of theirs has made it into the dex yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
