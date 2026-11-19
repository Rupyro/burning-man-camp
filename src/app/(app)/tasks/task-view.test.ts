// Labels and form reading for the task screens (spec S1–S4), without a browser.
import { describe, expect, it } from "vitest";
import {
  CHANNEL_CHOICES,
  claimLabel,
  dueLabel,
  readPreferenceForm,
  readTaskForm,
  roomLabel,
  statusLabel,
  typeLabel,
} from "./task-view";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";
const due = new Date("2027-04-12T17:00:00Z"); // 10:00 camp time

describe("task labels", () => {
  it("says when it's due, and flags overdue or soon", () => {
    expect(dueLabel(null, "normal")).toBe("No due date");
    expect(dueLabel(due, "normal")).toBe("Due Mon, Apr 12, 10:00 AM PT");
    expect(dueLabel(due, "soon")).toBe("Due soon · Mon, Apr 12, 10:00 AM PT");
    expect(dueLabel(due, "overdue")).toBe("Overdue · was due Mon, Apr 12, 10:00 AM PT");
  });

  it("names statuses, helper room and the claim button", () => {
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(statusLabel(null)).toBe("To do");
    expect(roomLabel(0, null)).toBe("No helpers yet");
    expect(roomLabel(1, null)).toBe("1 helper");
    expect(roomLabel(2, 3)).toBe("2 of 3 helpers");
    expect(claimLabel("open")).toBe("Claim");
    expect(claimLabel("open_with_approval")).toBe("Ask to help");
  });

  it("names notification types and channels", () => {
    expect(typeLabel("task.assigned")).toBe("Assigned to me");
    expect(typeLabel("shifts.gap")).toBe("shifts.gap");
    expect(CHANNEL_CHOICES.map((c) => c.value)).toEqual([
      "in_app",
      "email_immediate",
      "email_digest",
      "off",
    ]);
  });
});

describe("readTaskForm", () => {
  it("turns the add-task form into the action's input (camp time)", () => {
    expect(
      readTaskForm("p1", form({ title: " Rig ", dueDate: "2027-04-12", dueTime: "10:00" })),
    ).toEqual({
      ok: true,
      input: { projectId: "p1", title: "Rig", dueAt: "2027-04-12T17:00:00.000Z" },
    });
    expect(readTaskForm("p1", form({ title: "Rig", dueDate: "2027-04-12" }))).toMatchObject({
      input: { dueAt: "2027-04-12T07:00:00.000Z" },
    });
    expect(readTaskForm("p1", form({ title: "Rig", takeIt: "on" }), "me")).toMatchObject({
      input: { ownerPersonId: "me" },
    });
    expect(readTaskForm("p1", form({ title: "  " }))).toEqual({
      ok: false,
      error: "Give the task a title.",
    });
  });
});

describe("readPreferenceForm", () => {
  it("accepts a known channel only", () => {
    expect(readPreferenceForm(form({ type: "task.comment", channel: "off" }))).toEqual({
      ok: true,
      input: { type: "task.comment", channel: "off" },
    });
    expect(readPreferenceForm(form({ type: "task.comment", channel: "pigeon" }))).toEqual({
      ok: false,
      error: "Pick how you want to hear about it.",
    });
  });
});
