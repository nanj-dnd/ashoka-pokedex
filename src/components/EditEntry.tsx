"use client";

import { useEffect, useRef, useState } from "react";
import { api, sfx } from "@/lib/client";
import { loadImage, processCapture, type CapturedImages } from "@/lib/pixelate";
import { ZoomSlider } from "./Bits";
import { EntryFields, draftToBody, type EntryDraft } from "./EntryFields";
import type { Creature } from "@/lib/types";

const INK = "#ffcb05";

/**
 * The admin editor. Entries are about real people, so being wrong about one
 * should be a ten-second fix rather than a delete-and-re-shoot. Everything the
 * capture form collects can be rewritten here, including the photo.
 */
export function EditEntry({
  creature,
  onSaved,
  onClose,
}: {
  creature: Creature;
  onSaved: (updated: Creature) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  /** The replacement image at full resolution, so zoom can re-crop it freely. */
  const sourceRef = useRef<CanvasImageSource | null>(null);

  const [draft, setDraft] = useState<EntryDraft>({
    name: creature.name,
    title: creature.title,
    types: creature.types,
    habitat: creature.habitat,
    batch: creature.batch,
    traits: creature.characteristics,
    entry: creature.entry,
    quote: creature.quote,
    stats: creature.stats,
  });
  const [traitDraft, setTraitDraft] = useState("");
  const [shot, setShot] = useState<CapturedImages | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      const img = await loadImage(file);
      sourceRef.current = img;
      setZoom(1);
      setShot(processCapture(img, 1));
      sfx.shutter();
    } catch (e) {
      setError(String((e as Error).message).toUpperCase());
    }
  }

  function keepOld() {
    sourceRef.current = null;
    setShot(null);
    setZoom(1);
  }

  // Re-crop from the original whenever the zoom moves.
  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    setShot(processCapture(source, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  async function save() {
    setError("");
    if (!draft.name.trim()) return setError("NAME REQUIRED");

    setBusy(true);
    try {
      const body: Record<string, unknown> = { fields: draftToBody(draft) };

      if (shot) {
        const uploaded = await api<{ spriteUrl: string; photoUrl: string }>("/api/upload", {
          method: "POST",
          body: JSON.stringify({ sprite: shot.sprite, photo: shot.photo }),
        });
        body.spriteUrl = uploaded.spriteUrl;
        body.photoUrl = uploaded.photoUrl;
      }

      const res = await api<{ creature: Creature }>(`/api/creatures/${creature.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      sfx.good();
      onSaved(res.creature);
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <h2 style={{ color: INK }}>EDIT ENTRY</h2>
          <button className="ghost" onClick={onClose}>CLOSE X</button>
        </div>

        <div className="stack">
          <div className="plate">
            <div className="label" style={{ marginBottom: 10 }}>SPRITE</div>
            <div className="row" style={{ alignItems: "center" }}>
              <img
                className="slot-sprite"
                style={{ maxWidth: 120, flex: "0 0 auto" }}
                src={shot ? shot.sprite : creature.spriteUrl}
                alt={creature.name}
              />
              <div className="stack" style={{ flex: 1 }}>
                <button onClick={() => fileRef.current?.click()}>REPLACE PHOTO</button>
                {shot ? (
                  <button className="ghost" onClick={keepOld}>KEEP THE OLD ONE</button>
                ) : null}
                <div className="label">
                  {shot ? "NEW SPRITE — NOT SAVED YET" : "UPLOAD A NEW PHOTO TO RE-SPRITE THIS ENTRY"}
                </div>
              </div>
            </div>
            {shot ? (
              <div style={{ marginTop: 12 }}>
                <ZoomSlider value={zoom} onChange={setZoom} ink={INK} />
              </div>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          <EntryFields
            draft={draft}
            onChange={setDraft}
            ink={INK}
            traitDraft={traitDraft}
            onTraitDraft={setTraitDraft}
          />

          {error ? <div className="err shake">{error}</div> : null}

          <div className="row">
            <button className="primary" onClick={save} disabled={busy}>
              {busy ? "SAVING…" : "SAVE CHANGES"}
            </button>
            <button className="ghost" style={{ flex: "0 0 auto" }} onClick={onClose} disabled={busy}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
