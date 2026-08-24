"use client";

import { BATCHES, HABITATS, STATS, STAT_HINT, TYPES, TYPE_HINT, batchLabel } from "@/lib/constants";
import type { CreatureType } from "@/lib/constants";
import { sfx } from "@/lib/client";
import { TypeChip } from "./Bits";
import type { Stats } from "@/lib/types";

/** Everything about an entry that a human types, as one editable object. */
export interface EntryDraft {
  name: string;
  title: string;
  types: CreatureType[];
  habitat: string;
  batch: string;
  traits: string[];
  entry: string;
  quote: string;
  stats: Stats;
}

export const BLANK_STATS: Stats = {
  presence: 50, charm: 50, volume: 50, volatility: 50, discipline: 50, burnout: 50,
};

export const BLANK_DRAFT: EntryDraft = {
  name: "",
  title: "",
  types: [],
  habitat: HABITATS[0],
  batch: BATCHES[0],
  traits: [],
  entry: "",
  quote: "",
  stats: BLANK_STATS,
};

/** Shape the API expects. Keeps the wire format in one place. */
export function draftToBody(d: EntryDraft) {
  return {
    name: d.name,
    title: d.title,
    types: d.types,
    habitat: d.habitat,
    batch: d.batch,
    characteristics: d.traits,
    entry: d.entry,
    quote: d.quote,
    stats: d.stats,
  };
}

export function rollStats(): Stats {
  return Object.fromEntries(
    STATS.map(({ key }) => [key, 20 + Math.floor(Math.random() * 76)]),
  ) as Stats;
}

/**
 * The identify / type / characteristics / stats half of an entry. Shared by the
 * capture flow, trainer nominations and the admin editor, so all three agree on
 * what an entry is and none of them can drift.
 *
 * `step` numbers the sections when it is part of a walkthrough; drop it in the
 * editor, where there is no sequence to follow.
 */
export function EntryFields({
  draft,
  onChange,
  ink,
  step,
  traitDraft,
  onTraitDraft,
}: {
  draft: EntryDraft;
  onChange: (next: EntryDraft) => void;
  ink: string;
  step?: (n: number) => string;
  traitDraft: string;
  onTraitDraft: (v: string) => void;
}) {
  const heading = (n: number, text: string) => (step ? `${step(n)}${text}` : text);
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) =>
    onChange({ ...draft, [key]: value });

  function toggleType(t: CreatureType) {
    sfx.move();
    const has = draft.types.includes(t);
    if (!has && draft.types.length >= 3) return;
    set("types", has ? draft.types.filter((x) => x !== t) : [...draft.types, t]);
  }

  function addTrait() {
    const v = traitDraft.trim();
    if (!v || draft.traits.length >= 8 || draft.traits.includes(v)) return;
    set("traits", [...draft.traits, v]);
    onTraitDraft("");
    sfx.select();
  }

  return (
    <>
      {/* ------------------------------ identity --------------------------- */}
      <div className="plate stack">
        <div className="label">{heading(2, "IDENTIFY")}</div>

        <div className="row">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>NAME *</div>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="WHO IS THIS"
              maxLength={40}
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>TITLE</div>
            <input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="The 3AM Dhaba Prophet"
              maxLength={60}
            />
          </div>
        </div>

        <div className="row">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>HABITAT</div>
            <select value={draft.habitat} onChange={(e) => set("habitat", e.target.value)}>
              {HABITATS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>BATCH</div>
            <select value={draft.batch} onChange={(e) => set("batch", e.target.value)}>
              {BATCHES.map((b) => <option key={b} value={b}>{batchLabel(b)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* -------------------------------- types ---------------------------- */}
      <div className="plate stack">
        <div className="label">
          {heading(3, `TYPING — PICK UP TO 3 (${draft.types.length}/3)`)}
        </div>
        <div className="chip-row">
          {TYPES.map((t) => (
            <span
              key={t}
              onClick={() => toggleType(t)}
              title={TYPE_HINT[t]}
              style={{ cursor: "pointer", opacity: draft.types.includes(t) ? 1 : 0.42 }}
            >
              <TypeChip type={t} outline={!draft.types.includes(t)} />
            </span>
          ))}
        </div>
        {draft.types.length ? (
          <div className="body-text dim">{TYPE_HINT[draft.types[draft.types.length - 1]]}</div>
        ) : (
          <div className="body-text dim">Hover a type to see what it means.</div>
        )}
      </div>

      {/* --------------------------- characteristics ----------------------- */}
      <div className="plate stack">
        <div className="label">
          {heading(4, `CHARACTERISTICS (${draft.traits.length}/8)`)}
        </div>
        <div className="row">
          <input
            value={traitDraft}
            onChange={(e) => onTraitDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrait(); } }}
            placeholder="Always has an iced coffee"
            maxLength={40}
          />
          <button style={{ flex: "0 0 auto" }} onClick={addTrait} disabled={draft.traits.length >= 8}>
            + ADD
          </button>
        </div>
        {draft.traits.length ? (
          <div className="chip-row">
            {draft.traits.map((t) => (
              <span
                key={t}
                onClick={() => { sfx.move(); set("traits", draft.traits.filter((x) => x !== t)); }}
                style={{ cursor: "pointer" }}
                title="Click to remove"
              >
                <span className="chip outline" style={{ ["--chip-color" as string]: ink }}>{t} ×</span>
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <div className="label" style={{ marginBottom: 6 }}>DEX ENTRY</div>
          <textarea
            value={draft.entry}
            onChange={(e) => set("entry", e.target.value)}
            placeholder="Materialises at the dhaba after midnight. Emits a low hum when approached before noon."
            maxLength={400}
          />
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>SIGNATURE QUOTE</div>
          <input
            value={draft.quote}
            onChange={(e) => set("quote", e.target.value)}
            placeholder="bro I'm so cooked"
            maxLength={160}
          />
        </div>
      </div>

      {/* -------------------------------- stats ---------------------------- */}
      <div className="plate stack">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
          <span className="label">{heading(5, "BASE STATS")}</span>
          <button style={{ fontSize: 8 }} onClick={() => { sfx.open(); set("stats", rollStats()); }}>
            ⚄ ROLL
          </button>
        </div>
        {STATS.map(({ key, label }) => (
          <div className="stat-row" key={key} title={STAT_HINT[key]}>
            <span className="stat-name">{label}</span>
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={draft.stats[key]}
              onChange={(e) => set("stats", { ...draft.stats, [key]: Number(e.target.value) })}
              style={{ ["--bar-c" as string]: ink }}
            />
            <span className="stat-val">{draft.stats[key]}</span>
          </div>
        ))}
      </div>
    </>
  );
}
