"use client";

/* Small browser-side helpers: device identity, fetch wrappers, chiptune blips. */

const DEVICE_KEY = "ashoka-dex-device";

/** A random per-browser id so "seen" lists survive without accounts. */
export function deviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-device-id": deviceId(),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `REQUEST FAILED (${res.status})`);
  return data;
}

/* ------------------------------- sound ---------------------------------- */

const SFX_KEY = "ashoka-dex-sfx";
let ctx: AudioContext | null = null;

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SFX_KEY) !== "off";
}

export function toggleSfx(): boolean {
  const next = !sfxEnabled();
  localStorage.setItem(SFX_KEY, next ? "on" : "off");
  return next;
}

/** Square-wave blip. Keeps the whole thing feeling like a handheld. */
export function blip(freq = 660, ms = 60, type: OscillatorType = "square"): void {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* audio is a nicety — never let it break an interaction */
  }
}

export const sfx = {
  move: () => blip(520, 40),
  select: () => blip(880, 70),
  open: () => { blip(660, 60); setTimeout(() => blip(990, 90), 70); },
  good: () => { blip(720, 60); setTimeout(() => blip(1080, 120), 80); },
  bad: () => blip(160, 200, "sawtooth"),
  shutter: () => { blip(1400, 30); setTimeout(() => blip(300, 90), 40); },
};
