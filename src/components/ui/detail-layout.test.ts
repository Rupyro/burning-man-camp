// The shared detail layout every task-like page uses (Remo's Oct 19 review).
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailLayout, DetailSection } from "./detail-layout";

describe("DetailLayout", () => {
  it("puts the title, description and grouped facts first and the tools in a side column", () => {
    const out = renderToStaticMarkup(
      h(
        DetailLayout,
        {
          title: "Source 2nd gas burner",
          description: "Borrow one from Kitchen B.",
          facts: [["Owner", "Alex"]],
          aside: h(DetailSection, { title: "Update", boxed: true }, "form"),
        },
        h(DetailSection, { title: "Comments" }, "none"),
      ),
    );
    expect(out.indexOf("<h1")).toBeLessThan(out.indexOf("Borrow one"));
    expect(out.indexOf("Borrow one")).toBeLessThan(out.indexOf("<dl"));
    expect(out).toContain("<dt");
    expect(out).toContain(">Owner</dt>");
    expect(out.indexOf("Comments")).toBeLessThan(out.indexOf("<aside"));
    expect(out).toMatch(/<aside[^>]*>.*Update/);
  });

  it("leaves out the description and side column when there are none", () => {
    const out = renderToStaticMarkup(h(DetailLayout, { title: "T", facts: [] }));
    expect(out).not.toContain("<aside");
    expect(out).not.toContain("max-w-prose");
  });
});
