// Project screen helpers (spec S2), without a browser.
import { describe, expect, it } from "vitest";
import { groupByTeam, readProjectForm, taskCounts } from "./project-view";

describe("groupByTeam", () => {
  it("keeps the team order and nests workstreams under their project", () => {
    const groups = groupByTeam([
      { id: "a", name: "Cloud", teamName: "Gift", parentProjectId: null },
      { id: "b", name: "Cloud: lights", teamName: "Gift", parentProjectId: "a" },
      { id: "c", name: "Kitchen build", teamName: "Kitchen", parentProjectId: null },
    ]);
    expect(groups.map((g) => [g.teamName, g.projects.map((p) => [p.name, p.depth])])).toEqual([
      [
        "Gift",
        [
          ["Cloud", 0],
          ["Cloud: lights", 1],
        ],
      ],
      ["Kitchen", [["Kitchen build", 0]]],
    ]);
  });
});

describe("taskCounts", () => {
  it("counts open, overdue and done", () => {
    expect(
      taskCounts([
        { status: "todo", urgency: "overdue" },
        { status: "blocked", urgency: "normal" },
        { status: "done", urgency: "normal" },
        { status: "cancelled", urgency: "normal" },
      ]),
    ).toBe("2 open · 1 overdue · 1 done");
  });
});

describe("readProjectForm", () => {
  it("needs a team and a name", () => {
    const get = (o: Record<string, string>) => (k: string) => o[k] ?? "";
    expect(readProjectForm(get({ teamId: "t", name: " Cloud " }))).toEqual({
      ok: true,
      input: { teamId: "t", name: "Cloud" },
    });
    expect(readProjectForm(get({ teamId: "t" }))).toEqual({
      ok: false,
      error: "Give the project a name.",
    });
    expect(readProjectForm(get({ name: "x" }))).toEqual({ ok: false, error: "Pick a team." });
  });
});
