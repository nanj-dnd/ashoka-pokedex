"use client";

import { PHOTO_SIZE, SPRITE_SIZE } from "./constants";

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

/** Centre-crop `source` to a square and draw it into a size×size canvas. */
function squareDraw(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  size: number,
  smooth: boolean,
): HTMLCanvasElement {
  const side = Math.min(sw, sh);
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
 * Snap every channel to a small number of levels and push saturation up.
 * This is what makes a phone photo read as a sprite rather than a thumbnail.
 */
function quantize(canvas: HTMLCanvasElement, levels = 5, saturation = 1.35): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const step = 255 / (levels - 1);

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // Saturate around luma before snapping, so the palette stays punchy.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    d[i] = Math.round(Math.min(255, Math.max(0, r)) / step) * step;
    d[i + 1] = Math.round(Math.min(255, Math.max(0, g)) / step) * step;
    d[i + 2] = Math.round(Math.min(255, Math.max(0, b)) / step) * step;
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
export function processCapture(source: CanvasImageSource): CapturedImages {
  const { w, h } = dims(source);
  if (!w || !h) throw new Error("Nothing to capture yet");

  const sprite = quantize(squareDraw(source, w, h, SPRITE_SIZE, false));
  const photo = squareDraw(source, w, h, PHOTO_SIZE, true);

  return {
    sprite: sprite.toDataURL("image/png"),
    photo: photo.toDataURL("image/jpeg", 0.82),
  };
}

export async function processFile(file: File): Promise<CapturedImages> {
  return processCapture(await loadImage(file));
}
