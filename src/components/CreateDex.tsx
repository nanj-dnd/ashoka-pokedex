"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";
import { PRESETS, slugProblem, slugify } from "@/lib/dexConfig";
import { LIMITS } from "@/lib/constants";

export function CreateDex() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ slug: string; admin: string; member: string } | null>(null);

  // The link follows the name until the moment someone edits it themselves.
  const effectiveSlug = slugTouched ? slug : slugify(name);
  const linkProblem = effectiveSlug ? slugProblem(effectiveSlug) : null;

  const chosen = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  async function create() {
    setError("");
    if (!name.trim()) return setError("NAME REQUIRED");
    if (linkProblem) return setError(linkProblem);

    setBusy(true);
    try {
      const res = await api<{
        dex: { slug: string; adminCode: string; memberCode: string };
      }>("/api/dexes", {
        method: "POST",
        body: JSON.stringify({ name, slug: effectiveSlug, tagline, preset }),
      });
      sfx.good();
      setDone({
        slug: res.dex.slug,
        admin: res.dex.adminCode,
        member: res.dex.memberCode,
      });
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell title="DEX CREATED" subtitle={`/d/${done.slug}`} actions={<SfxToggle />}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "20px 0 40px" }} className="stack">
          <div className="ok">YOUR DEX IS LIVE</div>

          <div className="plate stack">
            <div className="label">SHARE THIS LINK</div>
            <div className="body-text" style={{ wordBreak: "break-all" }}>
              {typeof window !== "undefined" ? window.location.origin : ""}/d/{done.slug}
            </div>
          </div>

          <div className="plate stack">
            <div className="label">THE TWO CODES</div>
            <div className="kv">
              <span className="label">ADMIN</span>
              <span className="body-text amber">{done.admin}</span>
            </div>
            <div className="kv">
              <span className="label">MEMBER</span>
              <span className="body-text cyan">{done.member}</span>
            </div>
            <p className="body-text dim">
              Hand out the member code freely. The admin code lets someone
              capture entries and approve the queue — give it to people you
              actually want running the place. You can see both again in
              settings.
            </p>
          </div>

          <button className="primary" onClick={() => router.push(`/d/${done.slug}`)}>
            ▶ OPEN YOUR DEX
          </button>
          <button className="ghost" onClick={() => router.push(`/d/${done.slug}/settings`)}>
            SET THE CONSTRAINTS
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="MAKE A DEX" subtitle="STEP ONE OF ONE" actions={<SfxToggle />}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 0 40px" }} className="stack">
        <div className="plate stack">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>NAME *</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.dexName}
              placeholder="Ashoka Pokedex"
              autoFocus
            />
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>LINK</div>
            <div className="row">
              <span className="body-text dim" style={{ flex: "0 0 auto" }}>/d/</span>
              <input
                value={effectiveSlug}
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                maxLength={32}
                placeholder="ashoka"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            {linkProblem ? (
              <div className="label danger" style={{ marginTop: 6 }}>{linkProblem}</div>
            ) : (
              <div className="label" style={{ marginTop: 6 }}>THIS IS WHAT YOU SHARE.</div>
            )}
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>TAGLINE</div>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={LIMITS.tagline}
              placeholder="A field guide to the creatures of Ashoka."
            />
          </div>
        </div>

        <div className="plate stack">
          <div className="label">START FROM</div>
          <div className="tabs">
            {PRESETS.map((p) => (
              <span
                key={p.id}
                className={`tab${preset === p.id ? " on" : ""}`}
                onClick={() => { sfx.move(); setPreset(p.id); }}
              >
                {p.name}
              </span>
            ))}
          </div>
          <p className="body-text dim">{chosen.blurb}</p>
          <div className="chip-row">
            {chosen.config.types.slice(0, 6).map((t) => (
              <span key={t.label} className="chip" style={{ ["--chip-color" as string]: t.color }}>
                {t.label}
              </span>
            ))}
          </div>
          <div className="label">
            {chosen.config.types.length} TYPES · {chosen.config.habitats.length} HABITATS ·{" "}
            {chosen.config.rarities.length} RARITY TIERS ·{" "}
            {chosen.config.requiredApprovals} APPROVAL
            {chosen.config.requiredApprovals === 1 ? "" : "S"}
          </div>
          <div className="label">EVERY ONE OF THESE IS EDITABLE AFTERWARDS.</div>
        </div>

        {error ? <div className="err shake">{error}</div> : null}

        <div className="row">
          <button className="primary" onClick={create} disabled={busy}>
            {busy ? "MAKING…" : "▶ MAKE IT"}
          </button>
          <button className="ghost" style={{ flex: "0 0 auto" }} onClick={() => router.push("/me")}>
            CANCEL
          </button>
        </div>
      </div>
    </Shell>
  );
}
