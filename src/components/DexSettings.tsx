"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";
import { LIMITS } from "@/lib/constants";
import {
  MAX_HABITATS,
  MAX_RARITIES,
  MAX_TYPES,
  MIN_RARITIES,
  type DexConfig,
  type RarityTier,
  type TypeDef,
} from "@/lib/dexConfig";

/** A colour well that stays square and hard-edged like everything else. */
function Swatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Colour"
      style={{
        width: 34,
        height: 34,
        padding: 0,
        flex: "0 0 auto",
        background: "none",
        cursor: "pointer",
      }}
    />
  );
}

/** Add/remove list of plain uppercase strings — habitats, cohort options. */
function WordList({
  items,
  onChange,
  placeholder,
  max,
  ink,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max: number;
  ink: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim().toUpperCase();
    if (!v || items.length >= max) return;
    // Case-insensitive duplicate check, matching what the server will do.
    if (items.some((i) => i.toUpperCase() === v)) return setDraft("");
    onChange([...items, v]);
    setDraft("");
    sfx.select();
  }

  return (
    <>
      <div className="row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          maxLength={28}
        />
        <button style={{ flex: "0 0 auto" }} onClick={add} disabled={items.length >= max}>
          + ADD
        </button>
      </div>
      {items.length ? (
        <div className="chip-row">
          {items.map((h) => (
            <span
              key={h}
              onClick={() => { sfx.move(); onChange(items.filter((x) => x !== h)); }}
              style={{ cursor: "pointer" }}
              title="Click to remove"
            >
              <span className="chip outline" style={{ ["--chip-color" as string]: ink }}>
                {h} ×
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="label danger">AT LEAST ONE IS NEEDED.</div>
      )}
      <div className="label">{items.length} / {max}</div>
    </>
  );
}

export function DexSettings({
  slug,
  name: initialName,
  tagline: initialTagline,
  listed: initialListed,
  config: initialConfig,
  codes,
}: {
  slug: string;
  name: string;
  tagline: string;
  listed: boolean;
  config: DexConfig;
  codes: { admin: string; member: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [listed, setListed] = useState(initialListed);
  const [config, setConfig] = useState<DexConfig>(initialConfig);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  const ink = "#35d6e6";
  const set = <K extends keyof DexConfig>(key: K, value: DexConfig[K]) =>
    setConfig({ ...config, [key]: value });

  /* ------------------------------ types ------------------------------- */

  function patchType(i: number, patch: Partial<TypeDef>) {
    const next = config.types.slice();
    next[i] = { ...next[i], ...patch };
    set("types", next);
  }

  function addType() {
    if (config.types.length >= MAX_TYPES) return;
    sfx.select();
    set("types", [...config.types, { label: "NEW TYPE", color: "#8b9bb4", hint: "" }]);
  }

  /* ----------------------------- rarities ------------------------------ */

  function patchRarity(i: number, patch: Partial<RarityTier>) {
    const next = config.rarities.slice();
    next[i] = { ...next[i], ...patch };
    set("rarities", next);
  }

  function addRarity() {
    if (config.rarities.length >= MAX_RARITIES) return;
    const top = config.rarities[config.rarities.length - 1];
    sfx.select();
    set("rarities", [
      ...config.rarities,
      {
        label: "NEW TIER",
        color: "#fb7185",
        share: Math.min(1, top.share + 0.2),
        minSightings: top.minSightings + 4,
      },
    ]);
  }

  /* ------------------------------- save -------------------------------- */

  async function save() {
    setError("");
    setNote("");
    if (!name.trim()) return setError("NAME REQUIRED");
    if (!config.types.length) return setError("AT LEAST ONE TYPE IS NEEDED");
    if (!config.habitats.length) return setError("AT LEAST ONE HABITAT IS NEEDED");

    setBusy(true);
    try {
      await api(`/api/d/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name, tagline, listed, config }),
      });
      sfx.good();
      setNote("SAVED");
      router.refresh();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    setError("");
    setBusy(true);
    try {
      await api(`/api/d/${slug}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: confirmDelete }),
      });
      sfx.good();
      router.replace("/me");
      router.refresh();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
      setBusy(false);
    }
  }

  return (
    <Shell
      title="SETTINGS"
      subtitle={`/d/${slug}`}
      actions={
        <>
          <SfxToggle />
          <button
            className="ghost"
            style={{ fontSize: 8, padding: "8px 10px" }}
            onClick={() => router.push(`/d/${slug}`)}
          >
            BACK
          </button>
        </>
      }
    >
      <div className="stack" style={{ paddingBottom: 40 }}>

        {/* ------------------------------ basics --------------------------- */}
        <div className="plate stack">
          <div className="label">THE DEX</div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>NAME</div>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.dexName} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>TAGLINE</div>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={LIMITS.tagline} />
          </div>
          <div className="row">
            <div>
              <div className="label" style={{ marginBottom: 6 }}>WHAT IS AN ENTRY CALLED?</div>
              <input
                value={config.nounSingular}
                onChange={(e) => set("nounSingular", e.target.value.toUpperCase())}
                maxLength={20}
                placeholder="CREATURE"
              />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>PLURAL</div>
              <input
                value={config.nounPlural}
                onChange={(e) => set("nounPlural", e.target.value.toUpperCase())}
                maxLength={20}
                placeholder="CREATURES"
              />
            </div>
          </div>
        </div>

        {/* ------------------------------- codes --------------------------- */}
        <div className="plate stack">
          <div className="label">CODES</div>
          <div className="kv">
            <span className="label">ADMIN</span>
            <span className="body-text amber">{codes.admin}</span>
          </div>
          <div className="kv">
            <span className="label">MEMBER</span>
            <span className="body-text cyan">{codes.member}</span>
          </div>
          <p className="body-text dim">
            Entering the admin code promotes someone who has already joined —
            that is how you hand out admin. Changing a code locks out future
            joiners without touching anyone already inside.
          </p>
        </div>

        {/* ------------------------------- rules --------------------------- */}
        <div className="plate stack">
          <div className="label">RULES</div>
          <div className="stat-row">
            <span className="stat-name" style={{ width: 150 }}>APPROVALS</span>
            <input
              className="slider"
              type="range"
              min={1}
              max={5}
              value={config.requiredApprovals}
              onChange={(e) => set("requiredApprovals", Number(e.target.value))}
              style={{ ["--bar-c" as string]: ink }}
            />
            <span className="stat-val">{config.requiredApprovals}</span>
          </div>
          <div className="label">
            DISTINCT ADMINS WHO MUST APPROVE BEFORE AN ENTRY GOES IN. NOBODY CAN
            APPROVE THEIR OWN.
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className={config.membersCanNominate ? "primary" : "ghost"}
              onClick={() => { sfx.move(); set("membersCanNominate", !config.membersCanNominate); }}
            >
              MEMBERS CAN NOMINATE: {config.membersCanNominate ? "ON" : "OFF"}
            </button>
          </div>
          <div className="label">
            {config.membersCanNominate
              ? "ANYONE IN THE DEX CAN PUT AN ENTRY INTO THE QUEUE."
              : "ONLY ADMINS CAN ADD ENTRIES."}
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className={listed ? "primary" : "ghost"}
              onClick={() => { sfx.move(); setListed(!listed); }}
            >
              LISTED PUBLICLY: {listed ? "ON" : "OFF"}
            </button>
          </div>
          <div className="label">
            OFF MEANS THE DEX IS REACHABLE ONLY BY SOMEONE HOLDING THE LINK AND A
            CODE. LEAVE IT OFF FOR A DEX OF REAL PEOPLE.
          </div>
        </div>

        {/* ------------------------------- types --------------------------- */}
        <div className="plate stack">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
            <span className="label">TYPES ({config.types.length}/{MAX_TYPES})</span>
            <button style={{ fontSize: 8 }} onClick={addType} disabled={config.types.length >= MAX_TYPES}>
              + ADD
            </button>
          </div>
          <div className="label">THE LABEL STAYS DRY. PUT THE JOKE IN THE DESCRIPTION.</div>

          {config.types.map((t, i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="row">
                <Swatch value={t.color} onChange={(v) => patchType(i, { color: v })} />
                <input
                  value={t.label}
                  onChange={(e) => patchType(i, { label: e.target.value.toUpperCase() })}
                  maxLength={24}
                  placeholder="TYPE"
                />
                <button
                  className="ghost"
                  style={{ flex: "0 0 auto", fontSize: 8 }}
                  onClick={() => { sfx.move(); set("types", config.types.filter((_, j) => j !== i)); }}
                >
                  ✕
                </button>
              </div>
              <input
                value={t.hint}
                onChange={(e) => patchType(i, { hint: e.target.value })}
                maxLength={90}
                placeholder="Has never once finished a story."
              />
            </div>
          ))}
        </div>

        {/* ------------------------------ habitats ------------------------- */}
        <div className="plate stack">
          <div className="label">HABITATS</div>
          <div className="label">WHERE ENTRIES ARE USUALLY FOUND.</div>
          <WordList
            items={config.habitats}
            onChange={(v) => set("habitats", v)}
            placeholder="THE LIBRARY"
            max={MAX_HABITATS}
            ink={ink}
          />
        </div>

        {/* ------------------------------- stats --------------------------- */}
        <div className="plate stack">
          <div className="label">STATS</div>
          <div className="label">
            SIX BARS, ALWAYS. RENAMING ONE KEEPS THE NUMBERS ALREADY RECORDED
            AGAINST IT.
          </div>
          {config.stats.map((s, i) => (
            <div key={s.key} className="stack" style={{ gap: 6 }}>
              <input
                value={s.label}
                onChange={(e) => {
                  const next = config.stats.slice();
                  next[i] = { ...next[i], label: e.target.value.toUpperCase() };
                  set("stats", next);
                }}
                maxLength={18}
              />
              <input
                value={s.hint}
                onChange={(e) => {
                  const next = config.stats.slice();
                  next[i] = { ...next[i], hint: e.target.value };
                  set("stats", next);
                }}
                maxLength={90}
                placeholder="What this measures."
              />
            </div>
          ))}
        </div>

        {/* ------------------------------ rarity --------------------------- */}
        <div className="plate stack">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
            <span className="label">RARITY LADDER ({config.rarities.length}/{MAX_RARITIES})</span>
            <button
              style={{ fontSize: 8 }}
              onClick={addRarity}
              disabled={config.rarities.length >= MAX_RARITIES}
            >
              + ADD
            </button>
          </div>
          <p className="body-text dim">
            Rarity is earned, not assigned. Everyone enters at the bottom rung
            and climbs as more of the dex reports seeing them. A tier needs both
            a share of members AND a floor of raw sightings — without the floor,
            the first two people here would crown each other instantly.
          </p>

          {config.rarities.map((r, i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="row">
                <Swatch value={r.color} onChange={(v) => patchRarity(i, { color: v })} />
                <input
                  value={r.label}
                  onChange={(e) => patchRarity(i, { label: e.target.value.toUpperCase() })}
                  maxLength={18}
                />
                {i > 0 ? (
                  <button
                    className="ghost"
                    style={{ flex: "0 0 auto", fontSize: 8 }}
                    onClick={() => {
                      if (config.rarities.length <= MIN_RARITIES) return;
                      sfx.move();
                      set("rarities", config.rarities.filter((_, j) => j !== i));
                    }}
                    disabled={config.rarities.length <= MIN_RARITIES}
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {i === 0 ? (
                <div className="label">THE STARTING TIER — ALWAYS REACHABLE.</div>
              ) : (
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <div className="label" style={{ marginBottom: 4 }}>
                      SHARE: {Math.round(r.share * 100)}%
                    </div>
                    <input
                      className="slider"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(r.share * 100)}
                      onChange={(e) => patchRarity(i, { share: Number(e.target.value) / 100 })}
                      style={{ ["--bar-c" as string]: r.color }}
                    />
                  </div>
                  <div style={{ flex: "0 0 96px" }}>
                    <div className="label" style={{ marginBottom: 4 }}>MIN SEEN</div>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={r.minSightings}
                      onChange={(e) => patchRarity(i, { minSightings: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ------------------------------ cohort --------------------------- */}
        <div className="plate stack">
          <div className="label">EXTRA FIELD</div>
          <div className="label">
            AN OPTIONAL FIELD ON EVERY ENTRY — BATCH, TEAM, COMPANY. LEAVE THE
            LABEL BLANK TO HIDE IT ENTIRELY.
          </div>
          <input
            value={config.cohortLabel}
            onChange={(e) => set("cohortLabel", e.target.value.toUpperCase())}
            maxLength={18}
            placeholder="BATCH"
          />
          {config.cohortLabel ? (
            <>
              <div className="label" style={{ marginTop: 8 }}>
                FIXED OPTIONS — LEAVE EMPTY FOR FREE TEXT
              </div>
              <WordList
                items={config.cohortOptions}
                onChange={(v) => set("cohortOptions", v)}
                placeholder="UG2026"
                max={40}
                ink={ink}
              />
            </>
          ) : null}
        </div>

        {error ? <div className="err shake">{error}</div> : null}
        {note ? <div className="ok">{note}</div> : null}

        <button className="primary" onClick={save} disabled={busy}>
          {busy ? "SAVING…" : "▶ SAVE CONSTRAINTS"}
        </button>

        {/* ------------------------------ danger --------------------------- */}
        <div className="plate stack">
          <div className="label danger">DELETE THIS DEX</div>
          <p className="body-text dim">
            Every entry, sighting and membership goes with it. There is no undo.
            Type <strong className="amber">{slug}</strong> to confirm.
          </p>
          <div className="row">
            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={slug}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              style={{ flex: "0 0 auto", background: "var(--danger)", color: "#1a0505" }}
              onClick={destroy}
              disabled={busy || confirmDelete.trim().toLowerCase() !== slug.toLowerCase()}
            >
              DELETE
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
