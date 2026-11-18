import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeamBoard } from "./team-board";

const NOW = new Date("2027-04-10T07:00:00Z");
const task = {
  id: "t1",
  title: "Source burner",
  status: "todo" as const,
  blockedReason: null,
  dueAt: new Date("2027-04-02T07:00:00Z"),
  ownerName: "Sam",
  projectName: "Kit",
};

describe("My team block (spec B3 §4)", () => {
  it("lists late and blocked work and readiness bars", () => {
    const out = renderToStaticMarkup(
      h(TeamBoard, {
        now: NOW,
        board: {
          teams: ["Kitchen"],
          problems: [
            task,
            {
              ...task,
              id: "t2",
              status: "blocked",
              blockedReason: "generator",
              ownerName: null,
              dueAt: null,
            },
            { ...task, id: "t3", status: "blocked", blockedReason: null },
          ],
          projects: [{ id: "p", name: "Meal plan", done: 1, total: 4, percent: 25 }],
        },
      }),
    );
    expect(out).toContain("Kitchen");
    expect(out).toContain("8 days late");
    expect(out).toContain("Blocked: generator");
    expect(out).toContain("Nobody yet");
    expect(out).toContain('aria-valuenow="25"');
  });

  it("says so when nothing is late, and names 'All teams' for camp leads", () => {
    const out = renderToStaticMarkup(
      h(TeamBoard, { now: NOW, board: { teams: ["A", "B", "C"], problems: [], projects: [] } }),
    );
    expect(out).toContain("All teams");
    expect(out).toContain("Nothing late or blocked");
  });
});
