import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountdownView } from "./countdown-view";

const d = (s: string) => new Date(s);
const anchors = [
  {
    key: "build_start",
    label: "Build starts",
    startsAt: d("2027-04-21T06:00:00Z"),
    endsAt: null,
    isConfirmed: false,
  },
  {
    key: "event_start",
    label: "AfrikaBurn opens",
    startsAt: d("2027-04-26T10:00:00Z"),
    endsAt: null,
    isConfirmed: false,
  },
  {
    key: "strike_end",
    label: "Strike done",
    startsAt: d("2027-05-05T12:00:00Z"),
    endsAt: null,
    isConfirmed: true,
  },
];

describe("countdown screen", () => {
  it("shows days to build and to the burn, this week's jobs and the dates ahead", () => {
    const html = renderToStaticMarkup(
      h(CountdownView, { anchors, now: d("2026-11-02T12:00:00Z") }),
    );
    expect(html).toContain("days to build");
    expect(html).toContain("days to the burn");
    expect(html).toContain("What to do this week");
    expect(html).toContain("Build starts");
    expect(html).toContain("Dates to confirm for 2027");
  });
  it("copes with no dates yet", () => {
    const html = renderToStaticMarkup(
      h(CountdownView, { anchors: [], now: d("2026-11-02T12:00:00Z") }),
    );
    expect(html).toContain("No dates yet");
  });
});
