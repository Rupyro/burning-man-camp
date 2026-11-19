// Day / night theme for camp: bright Golden Hour by day, indigo desert night after sunset.
// "auto" follows real sunrise and sunset at the event's site (the event pack's coords), computed
// here (NOAA sunrise equation), so there is no API call. Times are UTC instants.

import { EVENT } from "./event";
export type ThemeMode = "auto" | "day" | "night";
export const THEME_KEY = "oe-theme";
export const TANKWA = { lat: -32.33, lon: 19.75 } as const;
/** Where the camp's event happens (Black Rock City or Tankwa Town). */
export const CAMP_SITE = EVENT.coords;

/**
 * Whether it is night at `nowMs` for the given place. Self-contained on purpose (no outside
 * references): its source text is also inlined as the pre-paint script in the root layout.
 * Returns [isNight, msUntilNextSunriseOrSunset].
 */
export function sunState(nowMs: number, lat: number, lon: number): [boolean, number] {
  const rad = Math.PI / 180;
  const day = 86400000;
  // Sunrise and sunset (UTC ms) for the UTC calendar day that contains `ms`.
  const times = (ms: number): [number, number] => {
    const n = Math.floor(ms / day) + 2440587.5 + 0.0008 - 2451545 + 0.5;
    const jStar = Math.round(n) - lon / 360;
    const m = (357.5291 + 0.98560028 * jStar) % 360;
    const c =
      1.9148 * Math.sin(m * rad) + 0.02 * Math.sin(2 * m * rad) + 0.0003 * Math.sin(3 * m * rad);
    const lambda = (m + c + 180 + 102.9372) % 360;
    const jTransit =
      2451545 + jStar + 0.0053 * Math.sin(m * rad) - 0.0069 * Math.sin(2 * lambda * rad);
    const dec = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad));
    const cosW =
      (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) /
      (Math.cos(lat * rad) * Math.cos(dec));
    const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
    const toMs = (j: number) => (j - 2440587.5) * day;
    return [toMs(jTransit - w / 360), toMs(jTransit + w / 360)];
  };
  const events: number[] = [];
  for (const offset of [-day, 0, day]) events.push(...times(nowMs + offset));
  events.sort((a, b) => a - b);
  const next = events.findIndex((t) => t > nowMs);
  // Events alternate sunrise, sunset; the next one being a sunrise means it is night now.
  const nextIsSunrise = next % 2 === 0;
  return [nextIsSunrise, (events[next] ?? nowMs + day) - nowMs];
}

export function parseMode(raw: string | null | undefined): ThemeMode {
  return raw === "day" || raw === "night" ? raw : "auto";
}

/** The theme to show and, in auto, how long until it should change (ms). */
export function resolveTheme(
  mode: ThemeMode,
  nowMs: number,
  at: { lat: number; lon: number } = CAMP_SITE,
): { night: boolean; nextChangeMs: number | null } {
  if (mode !== "auto") return { night: mode === "night", nextChangeMs: null };
  const [night, ms] = sunState(nowMs, at.lat, at.lon);
  return { night, nextChangeMs: ms };
}

/** The background photos, in rotation order (files in public/backdrop). */
export const PHOTOS = ["rock", "road"] as const;
export type Photo = (typeof PHOTOS)[number];

/**
 * Index into PHOTOS for the camp-time (Africa/Johannesburg, UTC+2, no DST) calendar day at
 * `nowMs`: day-of-year mod PHOTOS.length (2), so every visitor sees the same photo all day. Self-contained on
 * purpose: its source text is also inlined in the pre-paint script.
 */
export function photoIndex(nowMs: number): number {
  const d = new Date(nowMs + 2 * 3600000);
  const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  return doy % 2;
}

/** Inline script for <head>: sets the theme class before first paint so there is no flash. */
export function themeBootScript(): string {
  return `(function(){try{var s=${sunState.toString()};var m=localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )});var n=m==="night"||(m!=="day"&&s(Date.now(),${CAMP_SITE.lat},${CAMP_SITE.lon})[0]);var r=document.documentElement,c=r.classList;c.toggle("theme-night",n);c.toggle("dark",n);r.dataset.photo=${JSON.stringify(PHOTOS)}[(${photoIndex.toString()})(Date.now())];}catch(e){console.warn("theme boot",e);}})();`;
}
