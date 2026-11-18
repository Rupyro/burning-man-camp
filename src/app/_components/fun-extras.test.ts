import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/fun-extras";
import { FunToggle, FunView, LogoTaps, PlayaReveal } from "./fun-extras";

const base = {
  earned: ["tasks-10"],
  party: null,
  drop: null,
  fresh: null,
  sheet: null,
  late: false,
  onSheet: () => undefined,
  startY: { current: 0 },
};
const view = (p: Partial<typeof base> | Record<string, unknown>) =>
  renderToStaticMarkup(h(FunView, { ...base, ...p }));

describe("fun extras screens", () => {
  it("shows the badge row with locked badges greyed", () => {
    const html = view({});
    expect(html).toContain('aria-label="10 tasks finished"');
    expect(html).toContain("Strike helper (not earned yet)");
    expect(html).toContain("is-locked");
    expect(html).not.toContain("go to sleep");
  });
  it("shows the campfire with the same words every 10 tasks", () => {
    const html = view({ party: 20, late: true });
    expect(html).toContain("20 tasks finished!");
    expect(html).toContain("Next celebration at 30");
    expect(html).toContain("go to sleep, legend");
    expect(html).not.toContain("fun-sparkle");
    expect(view({ party: 100 })).toContain("fun-sparkle");
  });
  it("drops a new badge, then glows it once, and opens its details", () => {
    expect(view({ drop: "tasks-10" })).toContain("fun-drop-dust");
    expect(view({ drop: "tasks-10" })).toContain("is-empty");
    expect(view({ fresh: "tasks-10" })).toContain("is-fresh");
    const sheet = view({ sheet: "tasks-10" });
    expect(sheet).toContain("You finished 10 tasks for camp.");
    expect(sheet).toContain("Earned · Swipe down to close");
    expect(view({ sheet: "strike" })).toContain("Not earned yet");
  });
  it("renders the switch, the logo taps and the playa name", () => {
    expect(renderToStaticMarkup(h(FunToggle))).toContain("Fun extras: on");
    expect(renderToStaticMarkup(h(LogoTaps, null, "logo"))).toContain("logo");
    expect(renderToStaticMarkup(h(PlayaReveal, { name: "Dusty Sparrow" }))).toContain(
      "Dusty Sparrow",
    );
  });
});

type El = { props?: { role?: string; children?: unknown; [k: string]: unknown } };
const find = (node: unknown, role: string): El | null => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = find(n, role);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as El;
  if (el.props?.role === role) return el;
  return find(el.props?.children, role);
};

describe("badge details panel", () => {
  it("closes on a swipe down, not on a small nudge, and from the bar", () => {
    const closed: (string | null)[] = [];
    const startY = { current: 0 };
    const tree = FunView({ ...base, sheet: "tasks-10", onSheet: (id) => closed.push(id), startY });
    const sheet = find(tree, "dialog");
    const on = sheet?.props as unknown as Record<
      "onTouchStart" | "onTouchEnd",
      (e: unknown) => void
    >;
    on.onTouchStart({ touches: [{ clientY: 100 }] });
    expect(startY.current).toBe(100);
    on.onTouchEnd({ changedTouches: [{ clientY: 120 }] });
    expect(closed).toEqual([]);
    on.onTouchEnd({ changedTouches: [{ clientY: 200 }] });
    expect(closed).toEqual([null]);
    on.onTouchStart({ touches: [] });
    on.onTouchEnd({ changedTouches: [] });
    expect(startY.current).toBe(0);
  });
});

describe("badge row overflow", () => {
  it("shows +N when the row is full and lists every badge on tap", () => {
    const many = BADGES.map((b) => b.id);
    const html = view({ earned: many });
    expect(html).toContain("fun-badge-more");
    const all = view({ earned: many, sheet: "all" });
    expect(all).toContain("All my badges");
    expect(all).toContain("Founding family");
    expect(all).toContain("protea");
    expect(all).not.toMatch(/<text[^>]*>\s*[23]\s*</);
  });
});
