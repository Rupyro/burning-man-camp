// A faint dust gust that blows across the screen every ~5 minutes for 1-2 seconds.
// Timing logic lives here (pure, testable); the overlay is CSS transform/opacity only.

export const GUST_KEY = "oe-gust";
export const GUST_EVERY_MS = 5 * 60 * 1000;
export const GUST_JITTER_MS = 30 * 1000;
export const GUST_LENGTH_MS = 1600;

/** Gusts are on unless the person switched them off on this device. */
export function gustEnabled(raw: string | null | undefined): boolean {
  return raw !== "off";
}

/** ~5 minutes, give or take 30 seconds, so it never feels mechanical. */
export function nextGustDelay(rand: () => number = Math.random): number {
  return GUST_EVERY_MS + Math.round((rand() * 2 - 1) * GUST_JITTER_MS);
}

export type GustDeps = {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (t: unknown) => void;
  isHidden: () => boolean;
  reducedMotion: () => boolean;
  enabled: () => boolean;
  onGust: (on: boolean) => void;
  rand?: () => number;
};

/**
 * Schedules gusts. Skips entirely under reduced motion or when switched off, and pauses while
 * the tab is hidden (a gust that comes due while hidden waits for the tab to come back).
 */
export function createGustScheduler(d: GustDeps) {
  let timer: unknown = null;
  let endTimer: unknown = null;
  let due = false;
  const clear = () => {
    if (timer !== null) d.clearTimer(timer);
    timer = null;
  };
  const allowed = () => d.enabled() && !d.reducedMotion();
  const fire = () => {
    timer = null;
    if (!allowed()) return;
    if (d.isHidden()) {
      due = true;
      return;
    }
    gust();
    schedule();
  };
  const schedule = () => {
    clear();
    if (allowed()) timer = d.setTimer(fire, nextGustDelay(d.rand));
  };
  const gust = () => {
    d.onGust(true);
    if (endTimer !== null) d.clearTimer(endTimer);
    endTimer = d.setTimer(() => {
      endTimer = null;
      d.onGust(false);
    }, GUST_LENGTH_MS);
  };
  return {
    start: schedule,
    stop() {
      clear();
      due = false;
      if (endTimer !== null) {
        d.clearTimer(endTimer);
        endTimer = null;
        d.onGust(false);
      }
    },
    /** Call on visibilitychange. */
    visibility() {
      if (d.isHidden()) {
        if (timer !== null) {
          clear();
          due = false;
          // Resume a fresh countdown on return rather than firing the instant they come back.
        }
        return;
      }
      if (due && allowed()) {
        due = false;
        gust();
      }
      if (timer === null) schedule();
    },
    /** Blow one now (used by the preview and screenshots). */
    now() {
      if (allowed()) gust();
    },
  };
}
