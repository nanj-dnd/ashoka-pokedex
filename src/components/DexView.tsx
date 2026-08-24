"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BATCHES, HABITATS, RARITIES, RARITY_STYLE, TYPES, batchLabel } from "@/lib/constants";
import { api, sfx } from "@/lib/client";
import { Shell } from "./Shell";
import { DexProgress, SfxToggle } from "./Bits";
import { CreatureDetail } from "./CreatureDetail";
import { HallOfFame } from "./HallOfFame";
import { Nominate } from "./Nominate";
import type { PublicCreature } from "@/lib/types";

type Tab = "dex" | "hall" | "nominate";

const SORTS = [
  { key: "dex", label: "DEX NO." },
  { key: "notoriety", label: "MOST SEEN" },
  { key: "newest", label: "NEWEST" },
  { key: "name", label: "A → Z" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const NO_FILTERS = { rarity: "", type: "", habitat: "", batch: "" };

export function DexView({ role, username }: { role: "admin" | "public"; username: string }) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>("dex");
  const [creatures, setCreatures] = useState<PublicCreature[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>("dex");
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

  const toggleSeen = useCallback(async (c: PublicCreature) => {
    const nowSeen = !seen.has(c.id);
    const next = new Set(seen);
    nowSeen ? next.add(c.id) : next.delete(c.id);
    setSeen(next);
    // Keep the counter honest without a refetch.
    setCreatures((cur) =>
      cur.map((x) => (x.id === c.id ? { ...x, seenCount: x.seenCount + (nowSeen ? 1 : -1) } : x)),
    );
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
      setCreatures((cur) =>
        cur.map((x) => (x.id === c.id ? { ...x, seenCount: x.seenCount + (nowSeen ? -1 : 1) } : x)),
      );
    }
  }, [seen]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = creatures.filter((c) => {
      if (filters.rarity && c.rarity !== filters.rarity) return false;
      if (filters.type && !c.types.includes(filters.type as never)) return false;
      if (filters.habitat && c.habitat !== filters.habitat) return false;
      if (filters.batch && c.batch !== filters.batch) return false;
      if (onlyUnseen && seen.has(c.id)) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        c.habitat.toLowerCase().includes(needle) ||
        c.caughtBy.toLowerCase().includes(needle) ||
        c.characteristics.some((t) => t.toLowerCase().includes(needle))
      );
    });

    const by: Record<SortKey, (a: PublicCreature, b: PublicCreature) => number> = {
      dex: (a, b) => (a.dexNumber ?? 0) - (b.dexNumber ?? 0),
      notoriety: (a, b) => b.seenCount - a.seenCount || (a.dexNumber ?? 0) - (b.dexNumber ?? 0),
      newest: (a, b) => (b.approvedAt ?? b.createdAt).localeCompare(a.approvedAt ?? a.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [creatures, q, filters, onlyUnseen, seen, sort]);

  // The open card is resolved from the full list, not the filtered one: marking
  // an entry seen while UNSEEN ONLY is on drops it out of `shown`, and the card
  // you are reading should not vanish underneath you. It only loses its place
  // in the ‹ › walk.
  const open = openId ? creatures.find((c) => c.id === openId) ?? null : null;
  const openIndex = openId ? shown.findIndex((c) => c.id === openId) : -1;
  const inList = openIndex >= 0;

  const activeFilters = Object.values(filters).filter(Boolean).length;

  /** Arrow keys walk the grid; Enter opens whatever has focus. */
  function onGridKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const grid = gridRef.current;
    if (!grid) return;
    const slots = Array.from(grid.querySelectorAll<HTMLElement>(".slot"));
    const at = slots.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;

    // Read the real column count off the layout rather than guessing at it.
    const cols = Math.max(
      1,
      getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: 0, End: 0 }[e.key]!;
    const target =
      e.key === "Home" ? 0 : e.key === "End" ? slots.length - 1 : at + step;
    if (target < 0 || target >= slots.length) return;
    e.preventDefault();
    sfx.move();
    slots[target].focus();
  }

  async function logout() {
    await api("/api/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "dex", label: "DEX" },
    { key: "hall", label: "HALL OF FAME" },
    ...(role === "public" ? [{ key: "nominate" as Tab, label: "NOMINATE" }] : []),
  ];

  return (
    <Shell
      title="ASHOKA POKEDEX"
      subtitle={role === "admin" ? `ADMIN · ${username}` : `TRAINER · ${username}`}
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
      <div className="tabs">
        {tabs.map((t) => (
          <span
            key={t.key}
            className={`tab${tab === t.key ? " on" : ""}`}
            onClick={() => { sfx.move(); setTab(t.key); }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {tab === "hall" ? (
        <HallOfFame
          creatures={creatures}
          username={username}
          onOpenCreature={(c) => { setTab("dex"); setOpenId(c.id); }}
        />
      ) : tab === "nominate" ? (
        <Nominate />
      ) : (
        <>
          <DexProgress seen={creatures.filter((c) => seen.has(c.id)).length} total={creatures.length} />

          <div className="toolbar">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH…" aria-label="Search" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort by"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>SORT: {s.label}</option>)}
            </select>
            <button
              className={onlyUnseen ? "primary" : ""}
              style={{ fontSize: 8, flex: "0 0 auto" }}
              onClick={() => { sfx.move(); setOnlyUnseen((v) => !v); }}
            >
              {onlyUnseen ? "UNSEEN ONLY" : "SHOW ALL"}
            </button>
            <button
              className={activeFilters ? "primary" : ""}
              style={{ fontSize: 8, flex: "0 0 auto" }}
              onClick={() => { sfx.move(); setShowFilters((v) => !v); }}
            >
              FILTERS{activeFilters ? ` (${activeFilters})` : ""}
            </button>
          </div>

          {showFilters ? (
            <div className="toolbar">
              <select
                value={filters.rarity}
                onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
                aria-label="Filter by rarity"
              >
                <option value="">ALL RARITY</option>
                {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                aria-label="Filter by type"
              >
                <option value="">ALL TYPES</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filters.habitat}
                onChange={(e) => setFilters({ ...filters, habitat: e.target.value })}
                aria-label="Filter by habitat"
              >
                <option value="">ALL HABITATS</option>
                {HABITATS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select
                value={filters.batch}
                onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
                aria-label="Filter by batch"
              >
                <option value="">ALL BATCHES</option>
                {BATCHES.map((b) => <option key={b} value={b}>{batchLabel(b)}</option>)}
              </select>
              <button
                className="ghost"
                style={{ fontSize: 8, flex: "0 0 auto" }}
                onClick={() => { sfx.move(); setFilters(NO_FILTERS); setQ(""); }}
                disabled={!activeFilters && !q}
              >
                RESET
              </button>
            </div>
          ) : null}

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
            <>
              <div className="label" style={{ marginBottom: 10 }}>
                SHOWING {shown.length} OF {creatures.length}
              </div>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
              <div className="grid" ref={gridRef} onKeyDown={onGridKey}>
                {shown.map((c) => {
                  const isSeen = seen.has(c.id);
                  const ink = (RARITY_STYLE[c.rarity] ?? RARITY_STYLE.UNCOMMON).ink;
                  return (
                    <div
                      key={c.id}
                      className={`slot${isSeen ? "" : " unseen"}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${c.name}${isSeen ? ", seen" : ""}`}
                      onClick={() => { sfx.open(); setOpenId(c.id); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          sfx.open();
                          setOpenId(c.id);
                        }
                      }}
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
            </>
          )}
        </>
      )}

      {open ? (
        <CreatureDetail
          creature={open}
          seen={seen.has(open.id)}
          onToggleSeen={() => toggleSeen(open)}
          onClose={() => setOpenId(null)}
          position={inList ? { index: openIndex, total: shown.length } : undefined}
          onPrev={inList && openIndex > 0 ? () => setOpenId(shown[openIndex - 1].id) : undefined}
          onNext={
            inList && openIndex < shown.length - 1
              ? () => setOpenId(shown[openIndex + 1].id)
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}
