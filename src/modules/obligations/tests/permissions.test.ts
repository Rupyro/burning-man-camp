import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "obligations.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "obligations.manage": {
    allow: ["camp_lead", "admin"],
    deny: ["member", "team_lead", "finance_approver", "waitlisted"],
  },
  // Submitting your own obligation.
  "obligations.submit": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "alumni", "prospect"],
    resource: (a) => ({ ownerPersonId: a.personId }),
  },
});

describe("obligations.submit on someone else's obligation", () => {
  const other = { ownerPersonId: "01900000-0000-7000-8000-0000000000ff" };
  it.each(["camp_lead", "admin"] as const)("allows %s (a manager)", (name) => {
    expect(can(persona(name), "obligations.submit", other)).toBe(true);
  });
  it.each(["member", "team_lead", "finance_approver"] as const)("denies %s", (name) => {
    expect(can(persona(name), "obligations.submit", other)).toBe(false);
  });
  it("denies an unowned obligation to a plain member", () => {
    expect(can(persona("member"), "obligations.submit", { ownerPersonId: null })).toBe(false);
    expect(can(persona("member"), "obligations.submit")).toBe(false);
  });
});
