"use client";
import { useEffect, useState } from "react";
import { createGustScheduler, GUST_KEY, gustEnabled } from "@/lib/dust-gust";

export const GUST_CHANGE = "oe-gust-change";
export const GUST_NOW = "oe-gust-now";

/** Faint warm dust streaks crossing the screen now and then. Decorative, never interactive. */
export function DustGust() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const s = createGustScheduler({
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (t) => window.clearTimeout(t as number),
      isHidden: () => document.hidden,
      reducedMotion: () => reduced.matches,
      enabled: () => gustEnabled(localStorage.getItem(GUST_KEY)),
      onGust: setOn,
    });
    const restart = () => {
      s.stop();
      s.start();
    };
    const vis = () => s.visibility();
    const now = () => s.now();
    s.start();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener(GUST_CHANGE, restart);
    window.addEventListener(GUST_NOW, now);
    reduced.addEventListener("change", restart);
    return () => {
      s.stop();
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener(GUST_CHANGE, restart);
      window.removeEventListener(GUST_NOW, now);
      reduced.removeEventListener("change", restart);
    };
  }, []);
  if (!on) return null;
  return (
    <div aria-hidden className="dust-gust">
      {[12, 26, 38, 51, 63, 77, 88].map((top, i) => (
        <span key={top} style={{ top: `${top}%`, animationDelay: `${(i % 4) * 90}ms` }} />
      ))}
    </div>
  );
}

/** "Dust gusts: on/off" switch, saved on this device. */
export function DustGustToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(gustEnabled(localStorage.getItem(GUST_KEY))), []);
  const flip = () => {
    const next = !enabled;
    if (next) localStorage.removeItem(GUST_KEY);
    else localStorage.setItem(GUST_KEY, "off");
    setEnabled(next);
    window.dispatchEvent(new Event(GUST_CHANGE));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={flip}
      className={`min-h-8 whitespace-nowrap rounded-full border px-3 text-xs ${enabled ? "bg-primary text-primary-foreground" : "bg-popover text-popover-foreground"}`}
    >
      Dust gusts: {enabled ? "on" : "off"}
    </button>
  );
}
