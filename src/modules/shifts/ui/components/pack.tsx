"use client";
import { useEffect, useState } from "react";
import { packAssetUrls } from "../../rules/pack-assets";

const TICKS = "oe-pack-ticks";
const SAVED = "oe-pack-saved";

/** Registers the Burn pack service worker and says whether this page is saved for no-signal use. */
export function SavedBadge({ updated }: { updated: string }) {
  const [state, setState] = useState<"saving" | "saved" | "offline" | "none">("saving");
  const [when, setWhen] = useState(updated);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return setState("none");
    if (!navigator.onLine) {
      setWhen(localStorage.getItem(SAVED) ?? updated);
      return setState("offline");
    }
    navigator.serviceWorker
      .register("/pack-sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = [
          location.pathname,
          ...packAssetUrls(
            performance.getEntriesByType("resource").map((e) => e.name),
            location.origin,
          ),
        ];
        const ch = new MessageChannel();
        ch.port1.onmessage = (ev) => {
          if (ev.data !== "saved") return setState("none");
          localStorage.setItem(SAVED, updated);
          setState("saved");
        };
        reg.active?.postMessage({ save: urls }, [ch.port2]);
      })
      .catch(() => setState("none"));
  }, [updated]);
  const text = {
    saving: "Saving on this phone…",
    saved: `✓ Saved on this phone · works without signal · updated ${when}`,
    offline: `✓ No signal: showing your saved copy from ${when}`,
    none: "Couldn't save on this phone. Open it once more with signal, or print it.",
  }[state];
  return (
    <p
      aria-live="polite"
      className="self-start rounded-full border bg-card px-3 py-1 text-xs font-semibold"
    >
      {text}
    </p>
  );
}

/** Packing list you can tick; ticks stay on this phone only. */
export function TickList({ items }: { items: readonly string[] }) {
  const [ticked, setTicked] = useState<string[]>([]);
  useEffect(() => {
    try {
      setTicked(JSON.parse(localStorage.getItem(TICKS) ?? "[]"));
    } catch {
      setTicked([]);
    }
  }, []);
  const flip = (item: string) => {
    const next = ticked.includes(item) ? ticked.filter((t) => t !== item) : [...ticked, item];
    setTicked(next);
    localStorage.setItem(TICKS, JSON.stringify(next));
  };
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={ticked.includes(p)}
              onChange={() => flip(p)}
              className="size-5 shrink-0 accent-current"
            />
            <span className={ticked.includes(p) ? "line-through opacity-70" : ""}>{p}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
