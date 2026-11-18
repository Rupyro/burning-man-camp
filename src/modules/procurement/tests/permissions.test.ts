// docs/specs/procurement.md §4: every capability, allow and deny, plus wrong-record cases.
import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

const KITCHEN = "01900000-0000-7000-8000-00000000a001";
const OTHER_TEAM = "01900000-0000-7000-8000-00000000a0ff";

permissionMatrix(manifest, {
  "procurement.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "procurement.stock.count": {
    allow: ["member", "team_lead", "camp_lead"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  // Raising a need for Kitchen (team_lead is on Kitchen).
  "procurement.need.raise": {
    allow: ["team_lead"],
    deny: ["member", "admin", "waitlisted"],
    resource: () => ({ teamId: KITCHEN }),
  },
  "procurement.need.manage": {
    allow: ["team_lead", "camp_lead"],
    deny: ["member", "admin", "finance_approver", "waitlisted"],
    resource: () => ({ teamId: KITCHEN }),
  },
  "procurement.catalogue.manage": {
    allow: ["team_lead", "camp_lead", "admin"],
    deny: ["member", "finance_approver", "waitlisted"],
  },
  "procurement.ask": {
    allow: ["team_lead", "camp_lead"],
    deny: ["member", "admin", "finance_approver", "waitlisted", "prospect", "alumni"],
  },
  "procurement.draft": {
    allow: ["team_lead", "camp_lead"],
    deny: ["member", "admin", "finance_approver", "waitlisted", "prospect", "alumni"],
  },
  "procurement.review": {
    allow: ["admin"],
    deny: ["member", "team_lead", "camp_lead", "finance_approver", "waitlisted"],
  },
  "procurement.supplier.contact": {
    allow: ["team_lead", "camp_lead"],
    deny: ["member", "admin", "waitlisted"],
  },
});

describe("procurement record checks", () => {
  it("a team lead can't manage or raise needs for another team; a camp lead can manage any", () => {
    const lead = persona("team_lead");
    expect(can(lead, "procurement.need.manage", { teamId: OTHER_TEAM })).toBe(false);
    expect(can(lead, "procurement.need.raise", { teamId: OTHER_TEAM })).toBe(false);
    expect(can(lead, "procurement.need.manage")).toBe(false);
    expect(can(lead, "procurement.need.raise")).toBe(false);
    expect(can(persona("camp_lead"), "procurement.need.manage", { teamId: OTHER_TEAM })).toBe(true);
  });
  it("a waitlisted team lead can't count stock or raise needs", () => {
    const w = persona("team_lead", { memberStatus: "waitlisted" });
    expect(can(w, "procurement.stock.count")).toBe(false);
    expect(can(w, "procurement.need.raise", { teamId: KITCHEN })).toBe(false);
  });
});
