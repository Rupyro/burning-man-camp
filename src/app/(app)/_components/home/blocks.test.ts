// Server-render the home blocks to check what members see (spec B3 §3), without a browser.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArtCar, OxWagon, Wordmark } from "../../../_components/brand";
import { Countdown, ModuleTiles, NewForYou, NextThings } from "./blocks";
import { Chip } from "./chip";

// The Accept / Decline buttons refresh the page through the router; no router outside Next.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date("2027-04-10T07:00:00Z");
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("home blocks", () => {
  it("My next things: tasks with due chips and help offers with Accept / Decline", () => {
    const out = html(
      h(NextThings, {
        now: NOW,
        items: [
          {
            id: "a",
            title: "Buy clips",
            sub: "Kit",
            href: "/tasks/a",
            dueAt: new Date("2027-04-08T07:00:00Z"),
          },
          { id: "b", title: "No date", sub: "Kit", href: "/tasks/b", dueAt: null },
        ],
        help: [{ assignmentId: "x", taskId: "t", taskTitle: "Gazebo", personName: "Sam" }],
      }),
    );
    expect(out).toContain("Buy clips");
    expect(out).toContain("2 days late");
    expect(out).toContain("Sam offered to help");
    expect(out).toContain("Accept");
    expect(out).toContain("Decline");
    expect(out).not.toContain("Nothing waiting");
  });

  it("My next things: empty state", () => {
    expect(html(h(NextThings, { now: NOW, items: [], help: [] }))).toContain(
      "Nothing waiting for you right now.",
    );
  });

  it("Countdown: both halves, one half, or hidden", () => {
    const build = { days: 11, at: new Date("2027-04-21T06:00:00Z") };
    const gates = { days: 16, at: new Date("2027-04-26T10:00:00Z") };
    const both = html(h(Countdown, { build, gates }));
    expect(both).toContain("Days to build");
    expect(both).toContain("Days to gates");
    expect(both).toContain("21 Apr 2027");
    expect(html(h(Countdown, { build, gates: null }))).not.toContain("Days to gates");
    expect(html(h(Countdown, { build: null, gates }))).not.toContain("Days to build");
    expect(html(h(Countdown, { build: null, gates: null }))).toBe("");
  });

  it("New for you: items or all caught up", () => {
    const one = html(
      h(NewForYou, { items: [{ id: "n", title: "Hi", href: "/x", createdAt: NOW }] }),
    );
    expect(one).toContain("Hi");
    expect(html(h(NewForYou, { items: [] }))).toContain("all caught up");
  });

  it("Module tiles: only what it is given, with badge and failure text", () => {
    const tile = {
      id: "logistics",
      name: "Logistics",
      description: "d",
      icon: "hand",
      route: "/logistics",
      badge: 2,
      failed: false,
    };
    const out = html(
      h(ModuleTiles, { tiles: [tile, { ...tile, id: "f", badge: null, failed: true }] }),
    );
    expect(out).toContain('href="/logistics"');
    expect(out).toContain(">2<");
    expect(out).toContain("Couldn&#x27;t load");
    expect(html(h(ModuleTiles, { tiles: [] }))).toContain("No modules are open to you yet.");
  });

  it("brand pieces render with accessible names", () => {
    expect(html(h(Wordmark, {}))).toContain("Oe-aa-sies");
    expect(html(h(OxWagon, {}))).toContain('aria-label="Ox wagon"');
    expect(html(h(ArtCar, {}))).toContain('aria-label="Art car"');
    for (const tone of ["late", "soon", "normal", "blocked", "waiting"] as const)
      expect(html(h(Chip, { tone }, "x"))).toContain("x");
  });
});

describe("getting to camp tiles", () => {
  it("links the countdown and what to bring", async () => {
    const { GettingToCamp } = await import("./blocks");
    const { renderToStaticMarkup: r } = await import("react-dom/server");
    const { createElement } = await import("react");
    const html = r(createElement(GettingToCamp, { line: "170 days to build" }));
    expect(html).toContain('href="/countdown"');
    expect(html).toContain('href="/bring"');
    expect(html).toContain("170 days to build");
    expect(r(createElement(GettingToCamp, { line: null }))).toContain("what to do this week");
  });
});
