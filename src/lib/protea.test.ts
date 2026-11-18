import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { proteaStage } from "@/lib/family-years";
import { Protea } from "./protea";

describe("the growing protea", () => {
  it("opens one stage per year, full bloom from 4 (Founding family)", () => {
    expect([0, 1, 2, 3, 4, 7].map(proteaStage)).toEqual([0, 1, 2, 3, 4, 4]);
  });
  it("draws a closed bud with no centre, and more bracts and a bigger dome as it opens", () => {
    const bud = renderToStaticMarkup(h(Protea, { stage: 1 }));
    expect(bud).toContain('data-stage="1"');
    expect(bud).not.toContain("protea-dome");
    const counts = [1, 2, 3, 4].map(
      (s) => renderToStaticMarkup(h(Protea, { stage: s })).split("protea-bract").length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(renderToStaticMarkup(h(Protea, { stage: 3 }))).toContain("protea-dome");
  });
  it("glows only in full bloom, has no numbers, and can drop the stem for badges", () => {
    expect(renderToStaticMarkup(h(Protea, { stage: 3 }))).not.toContain("protea-glow");
    const full = renderToStaticMarkup(h(Protea, { stage: 4 }));
    expect(full).toContain("protea-glow");
    expect(full).not.toMatch(/<text/);
    expect(renderToStaticMarkup(h(Protea, { stage: 2, head: true }))).not.toContain("protea-stem");
    expect(renderToStaticMarkup(h(Protea, { stage: 0 }))).toContain('data-stage="1"');
  });
});
