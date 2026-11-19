// Task page helpers (spec S3): which controls to show and reading its forms, without a browser.
// The server re-checks every action; these only decide what's worth showing.
import { describe, expect, it } from "vitest";
import {
  canClaim,
  canTick,
  helperControls,
  readClaimModeForm,
  readDueForm,
  readStatusForm,
} from "./task-page-view";

const get = (o: Record<string, string>) => (k: string) => o[k] ?? "";
const h = (personId: string, status: "active" | "pending_approval") => ({ personId, status });

describe("controls", () => {
  it("leads decide others' pending claims and remove helpers; helpers can leave", () => {
    expect(helperControls(h("x", "pending_approval"), "lead", true)).toEqual({
      decide: true,
      leave: false,
      remove: true,
    });
    expect(helperControls(h("lead", "pending_approval"), "lead", true)).toEqual({
      decide: false,
      leave: true,
      remove: false,
    });
    expect(helperControls(h("x", "active"), "me", false)).toEqual({
      decide: false,
      leave: false,
      remove: false,
    });
  });

  it("claim only open, unfinished tasks I'm not on", () => {
    const t = { claimMode: "open" as const, open: true, ownerPersonId: "o" };
    expect(canClaim(t, [], "me")).toBe(true);
    expect(canClaim(t, [h("me", "pending_approval")], "me")).toBe(false);
    expect(canClaim({ ...t, ownerPersonId: "me" }, [], "me")).toBe(false);
    expect(canClaim({ ...t, claimMode: "closed" }, [], "me")).toBe(false);
    expect(canClaim({ ...t, open: false }, [], "me")).toBe(false);
    expect(canClaim(t, [], undefined)).toBe(false);
  });

  it("editors and active helpers tick the checklist", () => {
    expect(canTick(true, [], "me")).toBe(true);
    expect(canTick(false, [h("me", "active")], "me")).toBe(true);
    expect(canTick(false, [h("me", "pending_approval")], "me")).toBe(false);
  });
});

describe("forms", () => {
  it("status: blocked needs a reason, other statuses clear it", () => {
    expect(readStatusForm(get({ status: "blocked", blockedReason: " Shop shut " }))).toEqual({
      ok: true,
      input: { status: "blocked", blockedReason: "Shop shut" },
    });
    expect(readStatusForm(get({ status: "done", blockedReason: "x" }))).toEqual({
      ok: true,
      input: { status: "done", blockedReason: null },
    });
    expect(readStatusForm(get({ status: "blocked" }))).toEqual({
      ok: false,
      error: "Say why it's blocked.",
    });
    expect(readStatusForm(get({ status: "lost" }))).toEqual({ ok: false, error: "Pick a status." });
  });

  it("due date: camp time, or cleared", () => {
    expect(readDueForm(get({ dueDate: "2027-04-12", dueTime: "10:00" }))).toEqual({
      dueAt: "2027-04-12T17:00:00.000Z",
    });
    expect(readDueForm(get({}))).toEqual({ dueAt: null });
  });

  it("claim mode: capacity is optional and whole", () => {
    expect(readClaimModeForm(get({ claimMode: "open", claimCapacity: "3" }))).toEqual({
      ok: true,
      input: { claimMode: "open", claimCapacity: 3 },
    });
    expect(readClaimModeForm(get({ claimMode: "closed" }))).toEqual({
      ok: true,
      input: { claimMode: "closed", claimCapacity: null },
    });
    expect(readClaimModeForm(get({ claimMode: "open", claimCapacity: "2.5" }))).toEqual({
      ok: false,
      error: "Helpers needed must be a whole number.",
    });
    expect(readClaimModeForm(get({ claimMode: "maybe" }))).toEqual({
      ok: false,
      error: "Pick who can help.",
    });
  });
});
