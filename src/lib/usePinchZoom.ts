"use client";

import { useEffect, useRef, type RefObject } from "react";
import { clampZoom } from "./pixelate";

/**
 * Pinch-to-zoom over an element, plus trackpad pinch (which browsers deliver as
 * ctrl+wheel). The slider stays the accessible path; this is the one people
 * will actually reach for on a phone.
 *
 * The listeners are attached natively rather than through React because React
 * registers touch and wheel handlers as passive, and a passive listener cannot
 * call preventDefault — without which the browser zooms the whole page instead
 * of the viewfinder.
 */
export function usePinchZoom(
  targetRef: RefObject<HTMLElement | null>,
  getZoom: () => number,
  setZoom: (zoom: number) => void,
  enabled: boolean,
): void {
  // Held in refs so the effect only ever re-runs when `enabled` flips, rather
  // than on every render that produces a new closure.
  const get = useRef(getZoom);
  const set = useRef(setZoom);
  get.current = getZoom;
  set.current = setZoom;

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    let startDistance = 0;
    let startZoom = 1;

    const spread = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );

    /** Snap to a 20th, so a drifting pinch doesn't re-crop on every frame. */
    const apply = (zoom: number) => set.current(Math.round(clampZoom(zoom) * 20) / 20);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      startDistance = spread(e.touches);
      startZoom = get.current();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDistance) return;
      e.preventDefault();
      apply(startZoom * (spread(e.touches) / startDistance));
    };

    const onTouchEnd = () => {
      startDistance = 0;
    };

    const onWheel = (e: WheelEvent) => {
      // A trackpad pinch is a wheel event with ctrl held. A plain scroll is
      // the page scrolling past, and is none of our business.
      if (!e.ctrlKey) return;
      e.preventDefault();
      apply(get.current() * (1 - e.deltaY / 180));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [targetRef, enabled]);
}
