import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGustScheduler,
  GUST_EVERY_MS,
  GUST_JITTER_MS,
  GUST_LENGTH_MS,
  gustEnabled,
  nextGustDelay,
} from "./dust-gust";

describe("gust settings", () => {
  it("is on by default and off only when switched off", () => {
    expect(gustEnabled(null)).toBe(true);
    expect(gustEnabled("on")).toBe(true);
    expect(gustEnabled("off")).toBe(false);
  });
  it("waits about five minutes, within the jitter", () => {
    expect(nextGustDelay(() => 0.5)).toBe(GUST_EVERY_MS);
    expect(nextGustDelay(() => 0)).toBe(GUST_EVERY_MS - GUST_JITTER_MS);
    expect(nextGustDelay(() => 1)).toBe(GUST_EVERY_MS + GUST_JITTER_MS);
  });
});

describe("createGustScheduler", () => {
  let hidden = false;
  let reduced = false;
  let enabled = true;
  let events: boolean[] = [];
  const make = () =>
    createGustScheduler({
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
      isHidden: () => hidden,
      reducedMotion: () => reduced,
      enabled: () => enabled,
      onGust: (on) => events.push(on),
      rand: () => 0.5,
    });
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    reduced = false;
    enabled = true;
    events = [];
  });
  afterEach(() => vi.useRealTimers());

  it("blows every five minutes for a short burst", () => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(GUST_EVERY_MS - 1);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([true]);
    vi.advanceTimersByTime(GUST_LENGTH_MS);
    expect(events).toEqual([true, false]);
    vi.advanceTimersByTime(GUST_EVERY_MS - GUST_LENGTH_MS);
    expect(events).toEqual([true, false, true]);
    s.stop();
    expect(events.at(-1)).toBe(false);
  });

  it("never blows under reduced motion or when switched off", () => {
    reduced = true;
    const s = make();
    s.start();
    s.now();
    vi.advanceTimersByTime(GUST_EVERY_MS * 3);
    expect(events).toEqual([]);
    reduced = false;
    enabled = false;
    s.start();
    s.now();
    vi.advanceTimersByTime(GUST_EVERY_MS * 3);
    expect(events).toEqual([]);
  });

  it("pauses while the tab is hidden and restarts the countdown on return", () => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(GUST_EVERY_MS / 2);
    hidden = true;
    s.visibility();
    vi.advanceTimersByTime(GUST_EVERY_MS * 2);
    expect(events).toEqual([]);
    hidden = false;
    s.visibility();
    vi.advanceTimersByTime(GUST_EVERY_MS - 1);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([true]);
  });

  it("holds a gust that came due while hidden until the tab is back", () => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(GUST_EVERY_MS - 10);
    hidden = true; // hidden without a visibility event yet (timer fires first)
    vi.advanceTimersByTime(10);
    expect(events).toEqual([]);
    hidden = false;
    s.visibility();
    expect(events).toEqual([true]);
  });

  it("can blow one on demand", () => {
    const s = make();
    s.now();
    expect(events).toEqual([true]);
    vi.advanceTimersByTime(GUST_LENGTH_MS);
    expect(events).toEqual([true, false]);
  });
});
