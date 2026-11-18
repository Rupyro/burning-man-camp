// Up next queue rules (docs/specs/b3-home-up-next.md §1–2).
import { describe, expect, it } from "vitest";
import {
  buildQueue,
  countdownLine,
  fromHelp,
  fromModuleItem,
  fromMyTask,
  profileRow,
  type QueueItem,
  rankQueue,
  type TeamPulse,
  teamRows,
} from "@/base/landing/home-queue";
import type { MyItem } from "@/base/registry/types";

const NOW = new Date("2027-04-10T07:00:00Z");
const d = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const row = (id: string, tier: 0 | 1 | 2, at: Date | null, title = id): QueueItem => ({
  id,
  kind: "task",
  title,
  sub: "",
  href: "/",
  tier,
  at,
  action: "Open",
});
const item = (over: Partial<MyItem>): MyItem => ({
  id: "i1",
  moduleId: "finance",
  kind: "other",
  title: "Thing",
  urgency: "normal",
  href: "/finance/x",
  ...over,
});
const pulse = (over: Partial<TeamPulse>): TeamPulse => ({
  teamId: "k",
  name: "Kitchen",
  done: 1,
  total: 4,
  percent: 25,
  late: 0,
  blocked: 0,
  tasks: [],
  ...over,
});
const task = (id: string, status: string, dueAt: Date | null) => ({
  id,
  title: id,
  status,
  dueAt,
  ownerName: null,
  projectName: "Kit",
});

describe("rankQueue", () => {
  it("sorts by tier, then soonest date (undated last), then title; caps but counts all", () => {
    const { shown, total, all } = rankQueue(
      [
        row("c", 2, d(1)),
        row("b", 1, null),
        row("a", 1, d(3)),
        row("z", 0, null),
        row("y", 0, d(-5)),
        row("x2", 2, d(1), "Alpha"),
        row("e", 2, d(9)),
      ],
      5,
    );
    expect(shown.map((i) => i.id)).toEqual(["y", "z", "a", "b", "x2"]);
    expect(total).toBe(7);
    expect(all.map((i) => i.id).slice(5)).toEqual(["c", "e"]);
  });

  it("drops duplicate ids and defaults to 5 rows", () => {
    const many = Array.from({ length: 8 }, (_, i) => row(`r${i}`, 2, d(i)));
    const { shown, total } = rankQueue([...many, row("r0", 2, d(0))]);
    expect(shown).toHaveLength(5);
    expect(total).toBe(8);
  });
});

describe("queue rows", () => {
  it("my tasks: late is tier 0, this week tier 1, later tier 2, blocked tier 1", () => {
    const t = (dueAt: Date | null, status = "todo") =>
      fromMyTask({ id: "t", title: "T", projectName: "Kit", dueAt, status }, NOW);
    expect(t(d(-2))).toMatchObject({ tier: 0, chip: { tone: "late" }, href: "/tasks/t" });
    expect(t(d(2)).tier).toBe(1);
    expect(t(d(30)).tier).toBe(2);
    expect(t(null)).toMatchObject({ tier: 2, chip: undefined, action: "Open" });
    expect(t(d(-2), "blocked")).toMatchObject({
      tier: 1,
      chip: { label: "Blocked", tone: "blocked" },
    });
    expect(
      fromMyTask({ id: null, title: null, projectName: null, dueAt: null }, NOW),
    ).toMatchObject({ title: "", sub: "" });
  });

  it("module items: overdue tier 0, approvals at least tier 1, actions by kind", () => {
    expect(fromModuleItem(item({ urgency: "overdue" }), "Finance", NOW)).toMatchObject({
      tier: 0,
      sub: "Finance",
      id: "finance:i1",
    });
    expect(fromModuleItem(item({ kind: "approval" }), "Finance", NOW)).toMatchObject({
      tier: 1,
      action: "Review",
      kind: "approval",
    });
    expect(fromModuleItem(item({ urgency: "soon" }), "F", NOW).tier).toBe(1);
    expect(fromModuleItem(item({ kind: "alert" }), "F", NOW)).toMatchObject({
      tier: 2,
      action: "Check",
    });
    expect(fromModuleItem(item({ kind: "deadline", dueAt: d(3) }), "F", NOW)).toMatchObject({
      action: "Check",
      chip: { tone: "soon" },
      at: d(3),
    });
    expect(fromModuleItem(item({ kind: "ride" }), "F", NOW).action).toBe("Open");
    expect(fromModuleItem(item({ kind: "shift" }), "F", NOW).kind).toBe("other");
  });

  it("handovers: at least tier 1, the reason under the title, one action", () => {
    const h = fromModuleItem(
      item({ kind: "handover", title: "Fee unpaid 15 days: Sam", reason: "3 reminders, not paid" }),
      "Applications",
      NOW,
    );
    expect(h).toMatchObject({
      tier: 1,
      kind: "handover",
      sub: "Applications · 3 reminders, not paid",
      action: "Sort it out",
    });
  });

  it("help offers are tier 0 with Accept / Decline and the first name only", () => {
    expect(
      fromHelp({ assignmentId: "a", taskId: "t", taskTitle: "Gazebo", personName: "Sam (demo)" }),
    ).toMatchObject({
      id: "help:a",
      tier: 0,
      title: "Sam offered to help",
      sub: "“Gazebo”",
      help: { assignmentId: "a" },
    });
  });
});

describe("team summary rows (one per team)", () => {
  it("'Kitchen: 3 late' with blocked count and oldest lateness; carries the task list", () => {
    const tasks = [
      task("a", "todo", d(-8)),
      task("b", "in_progress", d(-2)),
      task("c", "blocked", d(5)),
    ];
    const [r] = teamRows([pulse({ late: 3, blocked: 1, tasks })], NOW);
    expect(r).toMatchObject({
      id: "team:k",
      kind: "late",
      tier: 0,
      title: "Kitchen: 3 late",
      sub: "1 blocked · oldest 8 days late",
      action: "See tasks",
      at: d(-8),
    });
    expect(r?.tasks).toHaveLength(3);
  });

  it("only blocked: tier 1 'Kitchen: 2 blocked'; nothing wrong: no row", () => {
    const rows = teamRows(
      [
        pulse({ blocked: 2, tasks: [task("c", "blocked", null)] }),
        pulse({ teamId: "g", name: "Gift" }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "blocked",
      tier: 1,
      title: "Kitchen: 2 blocked",
      sub: "Waiting on something",
      at: null,
    });
  });

  it("late without dates or blocked: no extra detail", () => {
    const [r] = teamRows([pulse({ late: 1, tasks: [task("a", "todo", null)] })], NOW);
    expect(r?.sub).toBe("Waiting on something");
  });
});

describe("buildQueue", () => {
  it("joins team rows, help, my tasks and module items; no shift rows; no repeats", () => {
    const q = buildQueue({
      now: NOW,
      mine: [
        { id: "a", title: "Mine and late", projectName: "Kit", dueAt: d(-8) },
        { id: "m", title: "Mine", projectName: "Kit", dueAt: d(2) },
      ],
      moduleItems: [item({ kind: "approval", moduleId: "finance" })],
      moduleName: (id) => (id === "finance" ? "Money" : id),
      help: [{ assignmentId: "h", taskId: "t", taskTitle: "Gazebo", personName: "Sam" }],
      teams: [pulse({ late: 1, tasks: [task("a", "todo", d(-8))] })],
    });
    expect(q.map((i) => i.id)).toEqual(["team:k", "help:h", "task:m", "finance:i1"]);
    expect(q.find((i) => i.id === "finance:i1")?.sub).toBe("Money");
    expect(q.some((i) => /shift/i.test(i.title))).toBe(false);
  });

  it("members (no teams): just their own things", () => {
    const q = buildQueue({
      now: NOW,
      mine: [{ id: "m", title: "Mine", projectName: "Kit", dueAt: null }],
      moduleItems: [],
      moduleName: (id) => id,
      help: [],
      teams: null,
    });
    expect(q.map((i) => i.id)).toEqual(["task:m"]);
  });
});

describe("countdownLine", () => {
  it("one line, hiding a missing half", () => {
    expect(countdownLine({ days: 12 }, { days: 40 })).toBe("12 days to build · 40 to gates");
    expect(countdownLine({ days: 12 }, null)).toBe("12 days to build");
    expect(countdownLine(null, { days: 40 })).toBe("40 days to gates");
    expect(countdownLine(null, null)).toBeNull();
  });
});

describe("My to-do: fill in your details (Sage, 21 Oct 2026)", () => {
  it("one row to /me naming what is missing, phone and emergency contact first", () => {
    const r = profileRow({ phone: "", emergencyName: "", emergencyPhone: "", arrival: null });
    expect(r?.title).toBe("Fill in your details");
    expect(r?.href).toBe("/me");
    expect(r?.sub).toBe("Missing: your phone, an emergency contact, your arrival date");
    expect(r?.tier).toBe(1);
  });

  it("an emergency contact counts as missing unless it has a name and a phone", () => {
    const r = profileRow({ phone: "1", emergencyName: "Mo", emergencyPhone: "", arrival: d(1) });
    expect(r?.sub).toBe("Missing: an emergency contact");
  });

  it("no row once everything is filled in", () => {
    expect(
      profileRow({ phone: "1", emergencyName: "Mo", emergencyPhone: "2", arrival: d(1) }),
    ).toBeNull();
  });
});
