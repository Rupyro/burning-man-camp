import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/base/people/server/packing-actions", () => ({ tickPacking: vi.fn() }));
const { PackingView } = await import("./packing-view");

describe("what to bring screen", () => {
  it("shows my count, ticked items struck through, and notes", () => {
    const html = renderToStaticMarkup(
      h(PackingView, { ticked: ["identification-passport"], tab: "bring" }),
    );
    expect(html).toMatch(/I bring · 1 of \d+/);
    expect(html).toContain("Priority");
    expect(html).toContain('checked=""');
    expect(html).toContain("1.5 gallons for every day");
    expect(html).toContain("Camping chairs");
    // Keyboard users see a focus ring on the box of the (visually hidden) checkbox.
    expect(html).toContain("peer sr-only");
    expect(html).toContain("peer-focus-visible:ring-2");
  });
  it("shows what the camp provides on the other tab", () => {
    const html = renderToStaticMarkup(h(PackingView, { ticked: [], tab: "provided" }));
    expect(html).toContain("The camp provides");
    expect(html).toContain("2 meals a day");
    expect(html).not.toContain('checked=""');
  });
});
