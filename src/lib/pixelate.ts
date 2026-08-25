"use client";

import { PHOTO_SIZE, SPRITE_LEVELS, SPRITE_SATURATION, SPRITE_SIZE } from "./constants";

/** Load any blob/file into a decoded bitmap we can draw. */
export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/**
 * How far into the frame you can crop. Zoom is digital — it takes a smaller
 * square out of the middle of the same frame — so this is really a limit on how
 * much upscaling the stored photo can take before it goes soft. At 3x a 1280px
 * camera frame still yields a ~426px crop, which the 160px sprite never
 * notices and the 720px photo survives.
 */
export const MAX_ZOOM = 3;

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(1, zoom)) : 1;
}

/**
 * Centre-crop `source` to a square and draw it into a size×size canvas.
 * `zoom` shrinks the square that gets taken, so 2 frames half as much of the
 * scene — the crop stays centred, which is where the viewfinder reticle is.
 */
function squareDraw(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  size: number,
  smooth: boolean,
  zoom = 1,
): HTMLCanvasElement {
  const side = Math.min(sw, sh) / clampZoom(zoom);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/**
 * 4x4 Bayer matrix, normalised to -0.5..+0.5. Nudging each pixel by a threshold
 * from this pattern before snapping turns hard colour banding into a fine
 * chequer — which is both more readable on a face and more authentically 8-bit
 * than flat posterised blobs.
 */
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

/**
 * Reduce to a small palette while keeping the face legible: mild saturation,
 * ordered dithering, then snap each channel to `levels` steps.
 */
function quantize(
  canvas: HTMLCanvasElement,
  levels = SPRITE_LEVELS,
  saturation = SPRITE_SATURATION,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const step = 255 / (levels - 1);

  for (let y = 0; y < canvas.height; y++) {
    for (let z = 0; z < canvas.width; z++) {
      const i = (y * canvas.width + z) * 4;
      const threshold = BAYER_4[y & 3][z & 3] * step;

      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      for (let k = 0; k < 3; k++) {
        const channel = [r, g, b][k];
        const saturated = luma + (channel - luma) * saturation;
        const dithered = saturated + threshold;
        d[i + k] = Math.round(Math.min(255, Math.max(0, dithered)) / step) * step;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface CapturedImages {
  /** Low-res quantised PNG — what the dex actually shows. */
  sprite: string;
  /** Full-colour JPEG kept alongside it. */
  photo: string;
}

function dims(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  const c = source as HTMLCanvasElement;
  return { w: c.width, h: c.height };
}

/** Turn a video frame or an uploaded photo into a sprite + a stored photo. */
export function processCapture(source: CanvasImageSource, zoom = 1): CapturedImages {
  const { w, h } = dims(source);
  if (!w || !h) throw new Error("Nothing to capture yet");

  const sprite = quantize(squareDraw(source, w, h, SPRITE_SIZE, false, zoom));
  const photo = squareDraw(source, w, h, PHOTO_SIZE, true, zoom);

  return {
    sprite: sprite.toDataURL("image/png"),
    photo: photo.toDataURL("image/jpeg", 0.82),
  };
}

/**
 * Freeze the current video frame at its native resolution.
 *
 * The shutter keeps the whole frame rather than the zoomed crop, so the framing
 * can still be adjusted after the fact without asking someone to stand there
 * and pose again. The crop is applied when the sprite is drawn, not here.
 */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Nothing to capture yet");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return canvas;
}

export async function processFile(file: File, zoom = 1): Promise<CapturedImages> {
  return processCapture(await loadImage(file), zoom);
}
