"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RARITIES, RARITY_STYLE, TYPES } from "@/lib/constants";
import { api, sfx } from "@/lib/client";
import { Shell } from "./Shell";
import { DexProgress, SfxToggle } from "./Bits";
import { CreatureDetail } from "./CreatureDetail";
import type { PublicCreature } from "@/lib/types";

export function DexView({ role, handle }: { role: "admin" | "public"; handle: string }) {
  const router = useRouter();
  const [creatures, setCreatures] = useState<PublicCreature[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<PublicCreature | null>(null);

  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [type, setType] = useState("");
  const [onlyUnseen, setOnlyUnseen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [dex, sight] = await Promise.all([
          api<{ creatures: PublicCreature[] }>("/api/creatures"),
          api<{ seen: string[] }>("/api/sightings"),
        ]);
        setCreatures(dex.creatures);
        setSeen(new Set(sight.seen));
      } catch (e) {
        setError(String((e as Error).message).toUpperCase());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleSeen(c: PublicCreature) {
    const next = new Set(seen);
    const nowSeen = !next.has(c.id);
    nowSeen ? next.add(c.id) : next.delete(c.id);
    setSeen(next);
    // Keep the counter honest without a refetch.
    setCreatures((cur) =>
      cur.map((x) => (x.id === c.id ? { ...x, seenCount: x.seenCount + (nowSeen ? 1 : -1) } : x)),
    );
    setOpen((cur) => (cur && cur.id === c.id ? { ...cur, seenCount: cur.seenCount + (nowSeen ? 1 : -1) } : cur));
    try {
      await api("/api/sightings", {
        method: "POST",
        body: JSON.stringify({ creatureId: c.id, seen: nowSeen }),
      });
    } catch {
      // Roll back a failed write so the tick never lies.
      setSeen((cur) => {
        const back = new Set(cur);
        nowSeen ? back.delete(c.id) : back.add(c.id);
        return back;
      });
    }
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creatures.filter((c) => {
      if (rarity && c.rarity !== rarity) return false;
      if (type && !c.types.includes(type as never)) return false;
      if (onlyUnseen && seen.has(c.id)) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        c.habitat.toLowerCase().includes(needle) ||
        c.characteristics.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [creatures, q, rarity, type, onlyUnseen, seen]);

  async function logout() {
    await api("/api/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Shell
      title="ASHOKA POKEDEX"
      subtitle={role === "admin" ? `ADMIN · ${handle}` : "TRAINER MODE"}
      actions={
        <>
          <SfxToggle />
          {role === "admin" ? (
            <button style={{ fontSize: 8, padding: "8px 10px" }} onClick={() => router.push("/admin")}>
              ADMIN
            </button>
          ) : null}
          <button className="ghost" style={{ fontSize: 8, padding: "8px 10px" }} onClick={logout}>
            EXIT
          </button>
        </>
      }
    >
      <DexProgress seen={creatures.filter((c) => seen.has(c.id)).length} total={creatures.length} />

      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH…" aria-label="Search" />
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filter by rarity">
          <option value="">ALL RARITY</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">ALL TYPES</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          className={onlyUnseen ? "primary" : ""}
          style={{ fontSize: 8, flex: "0 0 auto" }}
          onClick={() => { sfx.move(); setOnlyUnseen((v) => !v); }}
        >
          {onlyUnseen ? "UNSEEN ONLY" : "SHOW ALL"}
        </button>
      </div>

      {loading ? (
        <div className="empty"><span className="label blink">LOADING DEX</span></div>
      ) : error ? (
        <div className="empty"><span className="err">{error}</span></div>
      ) : !creatures.length ? (
        <div className="empty stack">
          <div className="label">THE DEX IS EMPTY</div>
          <div className="body-text dim">No creatures have been approved yet.</div>
        </div>
      ) : !shown.length ? (
        <div className="empty"><span className="label">NO MATCHES</span></div>
      ) : (
        <div className="grid">
          {shown.map((c) => {
            const isSeen = seen.has(c.id);
            const ink = (RARITY_STYLE[c.rarity] ?? RARITY_STYLE.COMMON).ink;
            return (
              <div
                key={c.id}
                className={`slot${isSeen ? "" : " unseen"}`}
                onClick={() => { sfx.open(); setOpen(c); }}
                style={isSeen ? { boxShadow: `inset 0 0 0 2px ${ink}66, 0 -4px 0 0 var(--edge), 0 4px 0 0 var(--edge), -4px 0 0 0 var(--edge), 4px 0 0 0 var(--edge)` } : undefined}
              >
                {isSeen ? <span className="seen-tick">✓</span> : null}
                <span className="slot-num">
                  No.{String(c.dexNumber ?? 0).padStart(3, "0")}
                </span>
                <img className="slot-sprite" src={c.spriteUrl} alt={c.name} loading="lazy" />
                <span className="slot-name" style={isSeen ? { color: ink } : undefined}>
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <CreatureDetail
          creature={open}
          seen={seen.has(open.id)}
          onToggleSeen={() => toggleSeen(open)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </Shell>
  );
}
