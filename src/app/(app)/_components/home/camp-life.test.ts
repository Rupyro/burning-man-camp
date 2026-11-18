// Server-render the "Camp life" home tiles (rides and the LNT quiz), without a browser.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampLifeTiles } from "./camp-life";

describe("camp life tiles", () => {
  it("links to the carpool board and the quiz", () => {
    const html = renderToStaticMarkup(h(CampLifeTiles));
    expect(html).toContain('href="/logistics/rides"');
    expect(html).toContain('href="/obligations/quiz"');
  });
});
