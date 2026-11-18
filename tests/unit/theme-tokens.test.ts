// The colours that used to be typed into components now live in camp-art/theme.css, with the
// same values. Next.js metadata reads the three chrome colours from camp-art/colors.ts, which
// must stay in lockstep with the CSS.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chromeThemeColor, manifestBackground, manifestTheme } from "../../camp-art/colors";

const css = readFileSync("camp-art/theme.css", "utf8");
const first = (name: string, from = css) => {
  const m = from.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m?.[1]) throw new Error(`missing ${name}`);
  return m[1].trim();
};
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark,"));
const night = css.slice(css.indexOf(".theme-night {"));

describe("camp-art colour tokens keep the old hard-coded values", () => {
  it("day and night menu colours (applicant settings)", () => {
    expect(first("--menu-border", root)).toBe("#d9b9a2");
    expect(first("--menu-bg", root)).toBe("#fffaf3");
    expect(first("--menu-fg", root)).toBe("#2e1c0e");
    expect(first("--menu-border", night)).toBe("#5a4030");
    expect(first("--menu-bg", night)).toBe("#2e2016");
    expect(first("--menu-fg", night)).toBe("#f1ded0");
  });

  it("HELP sheet, path fire and protea emblem", () => {
    expect(first("--pack-ink")).toBe("#2a2118");
    expect(first("--pack-paper")).toBe("#fffdf4");
    expect(first("--pack-line")).toBe("#c9d7e8");
    expect(first("--fire-hot")).toBe("#fff4c4");
    expect(first("--fire-mid")).toBe("#ffc35e");
    expect(first("--fire-ember")).toBe("#e08a2c");
    expect(first("--protea-stem")).toBe("#5f7a3a");
    expect(first("--protea-leaf-left")).toBe("#6f8f45");
    expect(first("--protea-leaf-right")).toBe("#7f9e52");
    expect(first("--protea-bract-back")).toBe("#f2a0a8");
    expect(first("--protea-bract-back-stroke")).toBe("#c8606e");
    expect(first("--protea-dome")).toBe("#f3e2d6");
    expect(first("--protea-dome-stroke")).toBe("#d9c3b0");
    expect(first("--protea-dome-highlight")).toBe("#fffaf0");
    expect(first("--protea-anther")).toBe("#c9bba8");
    expect(first("--protea-bract-front")).toBe("#e8707e");
    expect(first("--protea-bract-front-stroke")).toBe("#b04a5a");
  });

  it("browser-chrome colours in colors.ts match the CSS", () => {
    expect(chromeThemeColor).toBe(first("--color-earth"));
    expect(manifestBackground).toBe(first("--manifest-background"));
    expect(manifestTheme).toBe(first("--manifest-theme"));
  });
});
