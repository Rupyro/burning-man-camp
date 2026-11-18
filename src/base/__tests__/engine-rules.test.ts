// Pure work-engine rules (docs/specs/b2-task-engine.md T3, T4, D2, D4).
import { describe, expect, it } from "vitest";
import { findCycle, wouldCreateCycle } from "@/base/engine/rules/dependencies";
import { isAtRisk, isOpen, isOverdue, urgencyOf } from "@/base/engine/rules/risk";
import { RuleError, statusPatch } from "@/base/engine/rules/status";

const NOW = new Date("2027-04-10T07:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("dependencies: loop check (D2)", () => {
  const edges = [
    { taskId: "B", dependsOnTaskId: "A" },
    { taskId: "C", dependsOnTaskId: "B" },
  ];

  it("refuses a link that closes a loop, or a self-link", () => {
    expect(wouldCreateCycle(edges, { taskId: "A", dependsOnTaskId: "C" })).toBe(true);
    expect(wouldCreateCycle(edges, { taskId: "A", dependsOnTaskId: "A" })).toBe(true);
    expect(wouldCreateCycle(edges, { taskId: "A", dependsOnTaskId: "B" })).toBe(true);
  });

  it("allows links that keep it a chain or a fan-in", () => {
    expect(wouldCreateCycle(edges, { taskId: "C", dependsOnTaskId: "A" })).toBe(false);
    expect(wouldCreateCycle(edges, { taskId: "D", dependsOnTaskId: "C" })).toBe(false);
    expect(wouldCreateCycle([], { taskId: "X", dependsOnTaskId: "Y" })).toBe(false);
  });

  it("names the loop it found, start to end", () => {
    expect(findCycle(edges, { taskId: "A", dependsOnTaskId: "C" })).toEqual(["A", "C", "B", "A"]);
    expect(findCycle(edges, { taskId: "D", dependsOnTaskId: "C" })).toBeNull();
  });

  it("copes with diamonds without revisiting", () => {
    const diamond = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "A" },
      { taskId: "D", dependsOnTaskId: "B" },
      { taskId: "D", dependsOnTaskId: "C" },
    ];
    expect(wouldCreateCycle(diamond, { taskId: "A", dependsOnTaskId: "D" })).toBe(true);
    expect(wouldCreateCycle(diamond, { taskId: "E", dependsOnTaskId: "D" })).toBe(false);
  });
});

describe("status changes (T3, T4)", () => {
  const todo = { status: "todo" as const, completedAt: null };

  it("blocked needs a reason; with one it's saved, trimmed", () => {
    expect(() => statusPatch(todo, "blocked", "  ", NOW)).toThrow(RuleError);
    expect(() => statusPatch(todo, "blocked", null, NOW)).toThrow("Say why it's blocked");
    expect(statusPatch(todo, "blocked", " No forklift ", NOW)).toEqual({
      status: "blocked",
      blockedReason: "No forklift",
      completedAt: null,
    });
  });

  it("leaving blocked clears the reason", () => {
    expect(statusPatch({ status: "blocked", completedAt: null }, "in_progress", null, NOW)).toEqual(
      { status: "in_progress", blockedReason: null, completedAt: null },
    );
  });

  it("done stamps completed_at; reopening clears it; done again keeps the first stamp", () => {
    expect(statusPatch(todo, "done", null, NOW).completedAt).toEqual(NOW);
    const done = { status: "done" as const, completedAt: days(-2) };
    expect(statusPatch(done, "todo", null, NOW).completedAt).toBeNull();
    expect(statusPatch(done, "done", null, NOW).completedAt).toEqual(days(-2));
  });

  it("cancelled is not completed", () => {
    expect(statusPatch(todo, "cancelled", null, NOW).completedAt).toBeNull();
  });
});

describe("overdue, urgency and at risk (D4)", () => {
  it("only open tasks count as overdue", () => {
    expect(isOpen("todo") && isOpen("in_progress") && isOpen("blocked")).toBe(true);
    expect(isOpen("done") || isOpen("cancelled")).toBe(false);
    expect(isOverdue({ status: "todo", dueAt: days(-1) }, NOW)).toBe(true);
    expect(isOverdue({ status: "done", dueAt: days(-1) }, NOW)).toBe(false);
    expect(isOverdue({ status: "todo", dueAt: null }, NOW)).toBe(false);
    expect(isOverdue({ status: "todo", dueAt: days(1) }, NOW)).toBe(false);
  });

  it("urgency: overdue, soon (within 3 days), normal", () => {
    expect(urgencyOf({ status: "todo", dueAt: days(-1) }, NOW)).toBe("overdue");
    expect(urgencyOf({ status: "todo", dueAt: days(2) }, NOW)).toBe("soon");
    expect(urgencyOf({ status: "todo", dueAt: days(5) }, NOW)).toBe("normal");
    expect(urgencyOf({ status: "todo", dueAt: null }, NOW)).toBe("normal");
    expect(urgencyOf({ status: "done", dueAt: days(-5) }, NOW)).toBe("normal");
  });

  it("at risk when a prerequisite isn't done and is overdue or blocked", () => {
    expect(isAtRisk([{ status: "todo", dueAt: days(-1) }], NOW)).toBe(true);
    expect(isAtRisk([{ status: "blocked", dueAt: days(5) }], NOW)).toBe(true);
    expect(isAtRisk([{ status: "done", dueAt: days(-9) }], NOW)).toBe(false);
    expect(isAtRisk([{ status: "in_progress", dueAt: days(4) }], NOW)).toBe(false);
    expect(isAtRisk([], NOW)).toBe(false);
  });
});
