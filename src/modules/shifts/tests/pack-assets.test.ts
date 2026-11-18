// The Burn pack saves only its own static files for no-signal use, never other pages' data:
// saving every prefetched page made one pack visit re-render ~30 screens at once (Oct 28 2026).
import { describe, expect, it } from "vitest";
import { packAssetUrls } from "../rules/pack-assets";

const o = "https://camp.example";

describe("packAssetUrls", () => {
  it("keeps same-site static files and drops page / data requests and other sites", () => {
    expect(
      packAssetUrls(
        [
          `${o}/_next/static/chunks/a.js`,
          `${o}/_next/static/media/f.woff2`,
          `${o}/backdrop/day.webp`,
          `${o}/icon.png?v=2`,
          `${o}/tasks?_rsc=abc`,
          `${o}/shifts/s/1?_rsc=x`,
          `${o}/finance`,
          "https://other.example/_next/static/x.js",
        ],
        o,
      ),
    ).toEqual([
      `${o}/_next/static/chunks/a.js`,
      `${o}/_next/static/media/f.woff2`,
      `${o}/backdrop/day.webp`,
      `${o}/icon.png?v=2`,
    ]);
  });
});
