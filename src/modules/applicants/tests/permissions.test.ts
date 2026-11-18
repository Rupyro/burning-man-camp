// docs/specs/applicants.md §5: every capability, allow and deny, plus wrong-record cases.
import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

const SOMEONE = "01900000-0000-7000-8000-0000000000ff";

permissionMatrix(manifest, {
  "applicants.apply": {
    allow: ["prospect", "waitlisted"],
    deny: ["member", "team_lead", "camp_lead", "admin", "alumni"],
  },
  "applicants.welcome": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["prospect", "waitlisted"],
  },
  "applicants.review": {
    allow: ["team_lead", "camp_lead", "admin"],
    deny: ["member", "finance_approver", "prospect", "waitlisted", "alumni"],
  },
  // Someone else's application.
  "applicants.decide": {
    allow: ["team_lead", "camp_lead", "admin"],
    deny: ["member", "finance_approver", "prospect", "waitlisted", "alumni"],
    resource: () => ({ personId: SOMEONE }),
  },
});

describe("applicants record checks", () => {
  it("an applicant may only touch their own application", () => {
    const p = persona("prospect");
    expect(can(p, "applicants.apply", { personId: p.personId })).toBe(true);
    expect(can(p, "applicants.apply", { personId: SOMEONE })).toBe(false);
  });
  it("nobody decides their own application, and a decision needs a record", () => {
    const lead = persona("camp_lead");
    expect(can(lead, "applicants.decide", { personId: lead.personId })).toBe(false);
    expect(can(lead, "applicants.decide")).toBe(false);
  });
  it("an admin is never an applicant, even if their membership is prospect", () => {
    const a = persona("admin", { memberStatus: "prospect" });
    expect(a.isApplicant).toBe(false);
    expect(can(a, "applicants.apply")).toBe(false);
    expect(can(a, "applicants.review")).toBe(true);
  });
  it("a waitlisted team lead is an applicant, not a reviewer", () => {
    const w = persona("team_lead", { memberStatus: "waitlisted" });
    expect(w.isApplicant).toBe(true);
    expect(can(w, "applicants.review")).toBe(false);
    expect(can(w, "applicants.decide", { personId: SOMEONE })).toBe(false);
  });
  it("system actors are never applicants", () => {
    expect(persona("prospect", { kind: "system", personId: null }).isApplicant).toBe(false);
  });
});
