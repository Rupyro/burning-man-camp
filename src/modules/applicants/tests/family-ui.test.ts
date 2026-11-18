import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Render each step of the journey without a browser: useState hands out preset values in call order.
const preset: { values: unknown[]; i: number } = { values: [], i: 0 };
vi.mock("react", async (orig) => {
  const real = await orig<typeof import("react")>();
  return {
    ...real,
    useState: (init: unknown) => {
      const v = preset.i < preset.values.length ? preset.values[preset.i] : init;
      preset.i++;
      return [typeof v === "function" ? (v as () => unknown)() : v, () => undefined];
    },
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));
vi.mock("../server/family-actions", () => ({
  sendFamilyJourney: vi.fn(),
  decideFamily: vi.fn(),
}));

const { ComeHome, FamilyJourney, JourneyPath } = await import("../ui/components/family-journey");
const { FamilyDecide } = await import("../ui/components/family-decide");

const props = {
  years: [2023, 2024, 2025, 2026],
  nowIso: "2026-06-01T00:00:00Z",
  editionYear: 2027,
};
// step, page, family, years, teams, led, ledWhat, pieces, goodAt, loveTo, anything, msg
const at = (...values: unknown[]) => {
  preset.values = values;
  preset.i = 0;
  return renderToStaticMarkup(h(FamilyJourney, props));
};

beforeEach(() => {
  preset.values = [];
  preset.i = 0;
});

describe("family journey screens", () => {
  it("draws the path with the right campfire lit for each step", () => {
    for (const step of [1, 2, 3, 4]) {
      const html = renderToStaticMarkup(h(JourneyPath, { step }));
      expect(html).toContain("<svg");
    }
  });
  it("starts by asking if they camped with us, then offers the years", () => {
    expect(at()).toContain("journey-chip");
    const yes = at(1, 1, true, [2024, 2025]);
    expect(yes).toContain('data-stage="2"');
    expect(yes).not.toContain("🏮");
    expect(yes).toContain("is-on");
    const no = at(1, 1, false);
    expect(no).toContain("/apply/form");
  });
  it("walks Remember (both pages) and Dream", () => {
    expect(at(2, 1, true, [2025], ["Kitchen"], true, "the kitchen")).toContain("is-on");
    expect(at(2, 1, true, [2025], [], false)).toContain("journey");
    expect(at(2, 2, true, [2025], [], false, "", ["Shade"])).toContain("journey");
    expect(
      at(3, 1, true, [2025], [], true, "", [], ["Cooking"], ["Teaching"], "hi", "Oops"),
    ).toContain("Oops");
  });
  it("welcomes them home with their lanterns", () => {
    expect(renderToStaticMarkup(h(ComeHome, { name: "Sam", years: [2024, 2025, 2026] }))).toContain(
      "2026",
    );
    expect(renderToStaticMarkup(h(ComeHome, { name: "Sam", years: [] }))).toContain("Sam");
    const home = renderToStaticMarkup(h(ComeHome, { name: "Mia", years: [2024, 2025, 2026] }));
    expect(home).toContain('data-stage="3"');
    expect(home).not.toContain("🏮");
  });
  it("gives admins Welcome, Ask and Decline", () => {
    const html = renderToStaticMarkup(h(FamilyDecide, { id: "a1", name: "Robin Lee" }));
    expect(html).toContain("Welcome Robin in");
    expect(html).toContain("Ask a question");
    expect(html).toContain("Decline kindly");
  });
});
