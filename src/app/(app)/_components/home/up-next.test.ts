// Server-render the redesigned home pieces (docs/specs/b3-home-up-next.md), without a browser.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QueueItem } from "@/base/landing/home-queue";
import type { Tile } from "@/base/landing/landing";
import { homeCards } from "./cards";
import { ReadinessDialog } from "./readiness-dialog";
import { CategoryGrid, ReadinessList, UpNext } from "./up-next";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date("2027-04-10T07:00:00Z");
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const base: QueueItem = {
  id: "task:a",
  kind: "task",
  title: "Buy clips",
  sub: "Kit",
  href: "/tasks/a",
  tier: 0,
  at: null,
  chip: { label: "2 days late", tone: "late" },
  action: "Open",
};
const tile = (id: string, badge: number | null = null): Tile => ({
  id,
  name: id,
  description: "",
  icon: "box",
  route: `/${id}`,
  badge,
  failed: false,
});

describe("Up next", () => {
  it("rows link to their action with a chip; See all shows the total", () => {
    const out = html(h(UpNext, { items: [base], total: 7, title: "Up next", now: NOW }));
    expect(out).toContain("Up next");
    expect(out).toContain('href="/up-next"');
    expect(out).toContain("See all (7)");
    expect(out).toContain('href="/tasks/a"');
    expect(out).toContain("2 days late");
    expect(out).toContain(">Open<");
  });

  it("empty state, and no See all link on the full page", () => {
    const out = html(h(UpNext, { items: [], total: 0, title: "Up next", now: NOW, full: true }));
    expect(out).toContain("Nothing needs you right now");
    expect(out).not.toContain("See all");
  });

  it("help offers get Accept / Decline instead of a link", () => {
    const out = html(
      h(UpNext, {
        items: [{ ...base, id: "help:x", kind: "help", help: { assignmentId: "x" } }],
        total: 1,
        title: "Up next",
        now: NOW,
      }),
    );
    expect(out).toContain("Accept");
    expect(out).toContain("Decline");
  });

  it("a team summary row opens into that team's late tasks", () => {
    const row: QueueItem = {
      ...base,
      id: "team:k",
      kind: "late",
      title: "Kitchen: 3 late",
      sub: "oldest 8 days late",
      action: "See tasks",
      tasks: [
        {
          id: "t1",
          title: "Source burner",
          status: "todo",
          dueAt: new Date("2027-04-02T07:00:00Z"),
          ownerName: null,
          projectName: "Kit",
        },
        {
          id: "t2",
          title: "Gas",
          status: "blocked",
          dueAt: null,
          ownerName: "Sam",
          projectName: "Kit",
        },
      ],
    };
    const closed = html(h(UpNext, { items: [row], total: 1, title: "Needs you", now: NOW }));
    expect(closed).toContain("<details");
    expect(closed).not.toContain("<details open");
    expect(closed).toContain("Kitchen: 3 late");
    expect(closed).toContain('href="/tasks/t1"');
    expect(closed).toContain("8 days late");
    expect(closed).toContain("Nobody yet");
    expect(closed).toContain("Blocked");
    const open = html(h(UpNext, { items: [row], total: 1, title: "x", now: NOW, full: true }));
    expect(open).toContain('open=""');
  });
});

describe("readiness", () => {
  it("bars per team with percent and late count", () => {
    const out = html(
      h(ReadinessList, {
        teams: [
          {
            teamId: "k",
            name: "Kitchen",
            done: 1,
            total: 4,
            percent: 25,
            late: 3,
            blocked: 0,
            tasks: [],
          },
          {
            teamId: "g",
            name: "Gift",
            done: 2,
            total: 2,
            percent: 100,
            late: 0,
            blocked: 0,
            tasks: [],
          },
        ],
      }),
    );
    expect(out).toContain('aria-valuenow="25"');
    expect(out).toContain("25% · 1/4 · 3 late");
    expect(out).toContain("100% · 2/2<");
  });

  it("phone: an icon button that opens a dialog with the panel", () => {
    const out = html(h(ReadinessDialog, null, "PANEL"));
    expect(out).toContain('aria-label="Team readiness"');
    expect(out).toContain("<dialog");
    expect(out).toContain("PANEL");
    expect(out).toContain("lg:hidden");
  });
});

describe("category cards", () => {
  it("Shifts first and New, module cards only when visible, Camp info last, others kept", () => {
    const { cards, others } = homeCards(
      [tile("finance", 2), tile("logistics"), tile("exports")],
      false,
    );
    expect(cards.map((c) => c.id)).toEqual(["shifts", "finance", "logistics", "camp"]);
    expect(cards[0]).toMatchObject({ isNew: true, href: "/shifts" });
    expect(cards[1]).toMatchObject({ badge: 2, line: "Requests and receipts", href: "/finance" });
    expect(cards.at(-1)?.href).toBe("/camp");
    expect(others.map((t) => t.id)).toEqual(["exports"]);
    expect(homeCards([tile("finance")], true).cards[1]?.line).toBe("Approvals, budgets, spend");
  });

  it("renders badges and the New tag", () => {
    const { cards } = homeCards([tile("finance", 2)], false);
    const out = html(h(CategoryGrid, { cards }));
    expect(out).toContain("Everything else");
    expect(out).toContain(">New<");
    expect(out).toContain('2<span class="sr-only"> waiting</span>');
    expect(out).toContain('href="/camp"');
  });
});
