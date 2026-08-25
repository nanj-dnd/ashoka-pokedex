"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { grabFrame, loadImage, processCapture, type CapturedImages } from "@/lib/pixelate";
import { api, sfx } from "@/lib/client";
import { ZoomSlider } from "./Bits";
import { BLANK_DRAFT, EntryFields, draftToBody, type EntryDraft } from "./EntryFields";

/** Form accent. Rarity is earned later, so there's no rarity colour to borrow. */
const INK = "#35d6e6";

/**
 * The capture flow. Admins use it to add a catch straight into the queue;
 * trainers use the identical form to nominate someone. Both land as `pending`
 * and face the same admin quorum — the only difference is the wording and the
 * cap on how many a trainer may have in flight.
 */
export function Capture({
  onSubmitted,
  mode = "capture",
  atLimit = false,
  limitNote = "",
}: {
  onSubmitted: () => void;
  mode?: "capture" | "nominate";
  atLimit?: boolean;
  limitNote?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * The full-resolution frame or uploaded image behind the current shot. Zoom
   * re-crops from this rather than from the last crop, so framing stays
   * non-destructive however many times you change your mind.
   */
  const sourceRef = useRef<CanvasImageSource | null>(null);

  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState("");
  const [shot, setShot] = useState<CapturedImages | null>(null);
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState(false);

  const [draft, setDraft] = useState<EntryDraft>(BLANK_DRAFT);
  const [traitDraft, setTraitDraft] = useState("");

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
      setCamError("CAMERA UNAVAILABLE — USE UPLOAD");
    }
  }

  function shoot() {
    if (!videoRef.current) return;
    try {
      // Keep the whole frame; the zoom is a crop applied on the way out.
      const frame = grabFrame(videoRef.current);
      sourceRef.current = frame;
      setShot(processCapture(frame, zoom));
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
      const img = await loadImage(file);
      sourceRef.current = img;
      // A new picture deserves fresh framing rather than the last one's crop.
      setZoom(1);
      setShot(processCapture(img, 1));
      sfx.shutter();
      stopCam();
    } catch (e) {
      setCamError(String((e as Error).message).toUpperCase());
    }
  }

  function clearShot() {
    sourceRef.current = null;
    setShot(null);
    setZoom(1);
  }

  // Re-crop the shot whenever the zoom moves. Cheap enough to run live on the
  // slider: it is one 720px draw plus a 160px quantise pass.
  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    setShot(processCapture(source, zoom));
    // `shot` is derived from the source, so depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  /* ------------------------------- form -------------------------------- */

  function reset() {
    clearShot();
    setDraft(BLANK_DRAFT);
    setTraitDraft("");
    setError("");
  }

  async function submit() {
    setError("");
    if (!shot) return setError("TAKE A PHOTO FIRST");
    if (!draft.name.trim()) return setError("NAME REQUIRED");

    setBusy(true);
    try {
      const { spriteUrl, photoUrl } = await api<{ spriteUrl: string; photoUrl: string }>(
        "/api/upload",
        { method: "POST", body: JSON.stringify({ sprite: shot.sprite, photo: shot.photo }) },
      );

      await api("/api/creatures", {
        method: "POST",
        body: JSON.stringify({ ...draftToBody(draft), spriteUrl, photoUrl }),
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

  const nominating = mode === "nominate";

  if (atLimit) {
    return (
      <div className="empty stack">
        <div className="label amber">NOMINATION LIMIT REACHED</div>
        <div className="body-text dim">{limitNote}</div>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* ---------------------------- viewfinder --------------------------- */}
      <div className="plate">
        <div className="label" style={{ marginBottom: 10 }}>STEP 1 — CAPTURE</div>

        <div className="cam-stage">
          {shot ? (
            <img src={shot.sprite} alt="Captured sprite" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              // The viewfinder is scaled to match the crop, so what you frame
              // through the reticle is what the sprite ends up being.
              style={{ display: live ? "block" : "none", transform: `scale(${zoom})` }}
            />
          )}
          {!shot && !live ? (
            <div className="empty" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <span className="label blink">NO SIGNAL</span>
            </div>
          ) : null}
          {live || shot ? <div className="reticle" aria-hidden><i /><i /><i /><i /></div> : null}
          {flash ? <div className="flash" aria-hidden /> : null}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {shot ? (
            <button onClick={() => { sfx.move(); clearShot(); }}>RETAKE</button>
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

        {live || shot ? (
          <div style={{ marginTop: 12 }}>
            <ZoomSlider value={zoom} onChange={setZoom} ink={INK} />
          </div>
        ) : null}

        {camError ? <div className="err" style={{ marginTop: 10 }}>{camError}</div> : null}
        <div className="label" style={{ marginTop: 10 }}>
          PHOTOS BECOME A 160×160 SPRITE ON THIS DEVICE. CHECK THEY&apos;RE STILL RECOGNISABLE.
          {shot ? " ZOOM STILL WORKS — IT RE-CROPS THE SHOT YOU TOOK." : ""}
        </div>
      </div>

      <EntryFields
        draft={draft}
        onChange={setDraft}
        ink={INK}
        step={(n) => `STEP ${n} — `}
        traitDraft={traitDraft}
        onTraitDraft={setTraitDraft}
      />

      <div className="plate">
        <div className="label" style={{ marginBottom: 6 }}>
          {nominating ? "WHAT HAPPENS NEXT" : "RARITY IS EARNED"}
        </div>
        <div className="body-text dim">
          {nominating ? (
            <>
              Nominations go into the same queue as an admin&apos;s catch and need the
              same approvals to get in. You&apos;ll see how yours is doing under MY
              NOMINATIONS. Rarity is earned afterwards, from sightings — nobody sets it.
            </>
          ) : (
            <>
              Everyone enters the dex as UNCOMMON. They climb as more of campus reports
              seeing them — you don&apos;t get to set it.
            </>
          )}
        </div>
      </div>

      {error ? <div className="err shake">{error}</div> : null}

      <div className="row">
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "SENDING…" : nominating ? "SUBMIT NOMINATION" : "SUBMIT FOR APPROVAL"}
        </button>
        <button className="ghost" style={{ flex: "0 0 auto" }} onClick={reset} disabled={busy}>
          CLEAR
        </button>
      </div>
    </div>
  );
}
