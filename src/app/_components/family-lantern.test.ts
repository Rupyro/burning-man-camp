import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FamilyLantern } from "./family-lantern";

const now = new Date(Date.UTC(2026, 10, 1));
describe("family lantern card on My profile", () => {
  it("shows the confirmed years and how long they've walked the path", () => {
    const html = renderToStaticMarkup(h(FamilyLantern, { years: [2024, 2025, 2026], now }));
    expect(html).toContain("Oe-aa-sies Family");
    expect(html).toContain("2024 · 2025 · 2026 · 3 years in bloom");
    expect(html).not.toContain("Founding family");
    expect(html).toContain('data-stage="3"');
    expect(html).not.toContain("🏮");
  });
  it("names Founding family for every year since 2023", () => {
    const html = renderToStaticMarkup(h(FamilyLantern, { years: [2023, 2024, 2025, 2026], now }));
    expect(html).toContain("Founding family");
    expect(html).toContain('data-stage="4"');
    expect(html).toContain("protea-glow");
  });
  it("shows nothing without confirmed years", () => {
    expect(renderToStaticMarkup(h(FamilyLantern, { years: [], now }))).toBe("");
  });
});
