"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HABITATS, RARITIES, RARITY_HINT, RARITY_STYLE, STATS, TYPES } from "@/lib/constants";
import type { CreatureType, Rarity } from "@/lib/constants";
import { processCapture, processFile, type CapturedImages } from "@/lib/pixelate";
import { api, sfx } from "@/lib/client";
import { RarityBadge, TypeChip } from "./Bits";
import type { Stats } from "@/lib/types";

const BLANK_STATS: Stats = { vibe: 50, chaos: 50, academia: 50, social: 50, stamina: 50, mystery: 50 };

export function Capture({ onSubmitted }: { onSubmitted: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState("");
  const [shot, setShot] = useState<CapturedImages | null>(null);
  const [flash, setFlash] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [types, setTypes] = useState<CreatureType[]>([]);
  const [rarity, setRarity] = useState<Rarity>("COMMON");
  const [habitat, setHabitat] = useState<string>(HABITATS[0]);
  const [batch, setBatch] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [traitDraft, setTraitDraft] = useState("");
  const [entry, setEntry] = useState("");
  const [quote, setQuote] = useState("");
  const [stats, setStats] = useState<Stats>(BLANK_STATS);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* ------------------------------ camera ------------------------------- */

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => stopCam, [stopCam]);

  async function startCam() {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
      sfx.open();
    } catch {
      // Blocked, unsupported, or no camera — the file picker still works.
      setCamError("CAMERA UNAVAILABLE — USE UPLOAD");
    }
  }

  function shoot() {
    if (!videoRef.current) return;
    try {
      const images = processCapture(videoRef.current);
      setShot(images);
      setFlash(true);
      sfx.shutter();
      setTimeout(() => setFlash(false), 360);
      stopCam();
    } catch (e) {
      setCamError(String((e as Error).message).toUpperCase());
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      setShot(await processFile(file));
      sfx.shutter();
      stopCam();
    } catch (e) {
      setCamError(String((e as Error).message).toUpperCase());
    }
  }

  /* ------------------------------- form -------------------------------- */

  function toggleType(t: CreatureType) {
    sfx.move();
    setTypes((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 3 ? cur : [...cur, t],
    );
  }

  function addTrait() {
    const v = traitDraft.trim();
    if (!v || traits.length >= 8 || traits.includes(v)) return;
    setTraits([...traits, v]);
    setTraitDraft("");
    sfx.select();
  }

  function rollStats() {
    sfx.open();
    setStats(
      Object.fromEntries(
        STATS.map(({ key }) => [key, 20 + Math.floor(Math.random() * 76)]),
      ) as Stats,
    );
  }

  function reset() {
    setShot(null);
    setName("");
    setTitle("");
    setTypes([]);
    setRarity("COMMON");
    setHabitat(HABITATS[0]);
    setBatch("");
    setTraits([]);
    setTraitDraft("");
    setEntry("");
    setQuote("");
    setStats(BLANK_STATS);
    setError("");
  }

  async function submit() {
    setError("");
    if (!shot) return setError("TAKE A PHOTO FIRST");
    if (!name.trim()) return setError("NAME REQUIRED");

    setBusy(true);
    try {
      const { spriteUrl, photoUrl } = await api<{ spriteUrl: string; photoUrl: string }>(
        "/api/upload",
        { method: "POST", body: JSON.stringify({ sprite: shot.sprite, photo: shot.photo }) },
      );

      await api("/api/creatures", {
        method: "POST",
        body: JSON.stringify({
          name, title, types, rarity, habitat, batch,
          characteristics: traits, entry, quote, stats, spriteUrl, photoUrl,
        }),
      });

      sfx.good();
      reset();
      onSubmitted();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  const ink = RARITY_STYLE[rarity].ink;

  return (
    <div className="stack">
      {/* ---------------------------- viewfinder --------------------------- */}
      <div className="plate">
        <div className="label" style={{ marginBottom: 10 }}>STEP 1 — CAPTURE</div>

        <div className="cam-stage">
          {shot ? (
            <img src={shot.sprite} alt="Captured sprite" />
          ) : (
            <video ref={videoRef} playsInline muted style={{ display: live ? "block" : "none" }} />
          )}
          {!shot && !live ? (
            <div className="empty" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <span className="label blink">NO SIGNAL</span>
            </div>
          ) : null}
          {live || shot ? (
            <div className="reticle" aria-hidden><i /><i /><i /><i /></div>
          ) : null}
          {flash ? <div className="flash" aria-hidden /> : null}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {shot ? (
            <button onClick={() => { sfx.move(); setShot(null); }}>RETAKE</button>
          ) : live ? (
            <button className="primary" onClick={shoot}>◉ SHOOT</button>
          ) : (
            <button className="primary" onClick={startCam}>OPEN CAMERA</button>
          )}
          <button onClick={() => fileRef.current?.click()}>UPLOAD</button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }}
        />

        {camError ? <div className="err" style={{ marginTop: 10 }}>{camError}</div> : null}
        <div className="label" style={{ marginTop: 10 }}>
          PHOTOS ARE CRUSHED TO A 96×96 SPRITE ON THIS DEVICE.
        </div>
      </div>

      {/* ------------------------------ identity --------------------------- */}
      <div className="plate stack">
        <div className="label">STEP 2 — IDENTIFY</div>

        <div className="row">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>NAME *</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="WHO IS THIS" maxLength={40} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>TITLE</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Mess Hall Prophet" maxLength={60} />
          </div>
        </div>

        <div className="row">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>HABITAT</div>
            <select value={habitat} onChange={(e) => setHabitat(e.target.value)}>
              {HABITATS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>BATCH / YEAR</div>
            <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="UG26" maxLength={20} />
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 8 }}>TYPE — PICK UP TO 3 ({types.length}/3)</div>
          <div className="chip-row">
            {TYPES.map((t) => (
              <span
                key={t}
                onClick={() => toggleType(t)}
                style={{ cursor: "pointer", opacity: types.includes(t) ? 1 : 0.42 }}
              >
                <TypeChip type={t} outline={!types.includes(t)} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------- rarity ---------------------------- */}
      <div className="plate stack">
        <div className="label">STEP 3 — RARITY</div>
        <div className="chip-row">
          {RARITIES.map((r) => (
            <span
              key={r}
              onClick={() => { sfx.move(); setRarity(r); }}
              style={{ cursor: "pointer", opacity: rarity === r ? 1 : 0.35 }}
            >
              <RarityBadge rarity={r} />
            </span>
          ))}
        </div>
        <div className="body-text dim">{RARITY_HINT[rarity]}</div>
      </div>

      {/* --------------------------- characteristics ----------------------- */}
      <div className="plate stack">
        <div className="label">STEP 4 — CHARACTERISTICS ({traits.length}/8)</div>
        <div className="row">
          <input
            value={traitDraft}
            onChange={(e) => setTraitDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrait(); } }}
            placeholder="Always has an iced coffee"
            maxLength={40}
          />
          <button style={{ flex: "0 0 auto" }} onClick={addTrait} disabled={traits.length >= 8}>+ ADD</button>
        </div>
        {traits.length ? (
          <div className="chip-row">
            {traits.map((t) => (
              <span
                key={t}
                onClick={() => { sfx.move(); setTraits(traits.filter((x) => x !== t)); }}
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
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Known to appear at the dhaba at 3am. Emits a low hum when approached before noon."
            maxLength={400}
          />
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>SIGNATURE QUOTE</div>
          <input value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="bro I'm so cooked" maxLength={160} />
        </div>
      </div>

      {/* -------------------------------- stats ---------------------------- */}
      <div className="plate stack">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 0 }}>
          <span className="label">STEP 5 — BASE STATS</span>
          <button style={{ fontSize: 8 }} onClick={rollStats}>⚄ ROLL</button>
        </div>
        {STATS.map(({ key, label }) => (
          <div className="stat-row" key={key}>
            <span className="stat-name">{label}</span>
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={stats[key]}
              onChange={(e) => setStats({ ...stats, [key]: Number(e.target.value) })}
              style={{ ["--bar-c" as string]: ink }}
            />
            <span className="stat-val">{stats[key]}</span>
          </div>
        ))}
      </div>

      {error ? <div className="err shake">{error}</div> : null}

      <div className="row">
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "SENDING…" : "SUBMIT FOR APPROVAL"}
        </button>
        <button className="ghost" style={{ flex: "0 0 auto" }} onClick={reset} disabled={busy}>CLEAR</button>
      </div>
    </div>
  );
}
