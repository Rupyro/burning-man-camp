// docs/specs/finance.md §4: every capability, allow and deny, plus wrong-record cases.
import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

const KITCHEN = "01900000-0000-7000-8000-00000000a001";
const OTHER_TEAM = "01900000-0000-7000-8000-00000000a0ff";
const SOMEONE = "01900000-0000-7000-8000-0000000000ff";

permissionMatrix(manifest, {
  "finance.view": {
    allow: ["member", "team_lead", "finance_approver", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  // Asking for money for a team you're on (team_lead is on Kitchen).
  "finance.spend.request": {
    allow: ["team_lead"],
    deny: ["member", "finance_approver", "admin", "waitlisted"],
    resource: () => ({ teamId: KITCHEN }),
  },
  // Someone else's Kitchen request.
  "finance.spend.view": {
    allow: ["team_lead", "finance_approver", "camp_lead"],
    deny: ["member", "admin", "pilot", "waitlisted"],
    resource: () => ({ requesterId: SOMEONE, teamId: KITCHEN }),
  },
  // A finance-approver step on someone else's request.
  "finance.spend.approve": {
    allow: ["finance_approver", "camp_lead"],
    deny: ["member", "team_lead", "admin", "waitlisted"],
    resource: () => ({ approver: "role:finance_approver", requesterId: SOMEONE, teamId: KITCHEN }),
  },
  "finance.report.view": {
    allow: ["team_lead", "finance_approver", "camp_lead"],
    deny: ["member", "admin", "pilot", "waitlisted"],
  },
  "finance.manage": {
    allow: ["finance_approver", "camp_lead"],
    deny: ["member", "team_lead", "admin", "waitlisted"],
    resource: () => ({ payeeId: SOMEONE }),
  },
  // Someone else's camp fee (applicants spec §6).
  "finance.fees.manage": {
    allow: ["finance_approver", "camp_lead"],
    deny: ["member", "team_lead", "admin", "prospect", "waitlisted"],
    resource: () => ({ personId: SOMEONE }),
  },
});

describe("finance record checks", () => {
  it("you can always see your own request, even on a team you've left", () => {
    const me = persona("member");
    expect(can(me, "finance.spend.view", { requesterId: me.personId, teamId: OTHER_TEAM })).toBe(
      true,
    );
  });
  it("a team lead can't see another team's requests", () => {
    expect(
      can(persona("team_lead"), "finance.spend.view", { requesterId: SOMEONE, teamId: OTHER_TEAM }),
    ).toBe(false);
  });
  it("a team lead can't ask for money for a team they're not on", () => {
    expect(can(persona("team_lead"), "finance.spend.request", { teamId: OTHER_TEAM })).toBe(false);
    expect(can(persona("team_lead"), "finance.spend.request")).toBe(false);
  });
  it("nobody approves their own request", () => {
    const fa = persona("finance_approver");
    expect(
      can(fa, "finance.spend.approve", {
        approver: "role:finance_approver",
        requesterId: fa.personId,
        teamId: KITCHEN,
      }),
    ).toBe(false);
    expect(can(fa, "finance.spend.approve")).toBe(false);
  });
  it("finance can't mark their own pay-back paid", () => {
    const fa = persona("finance_approver");
    expect(can(fa, "finance.manage", { payeeId: fa.personId })).toBe(false);
    expect(can(fa, "finance.manage")).toBe(true);
  });
  it("finance can't record their own camp fee as paid", () => {
    const fa = persona("finance_approver");
    expect(can(fa, "finance.fees.manage", { personId: fa.personId })).toBe(false);
    expect(can(fa, "finance.fees.manage", { personId: null })).toBe(false);
    expect(can(fa, "finance.fees.manage")).toBe(true);
  });
  it("a waitlisted team member can't ask for money", () => {
    const w = persona("team_lead", { memberStatus: "waitlisted" });
    expect(can(w, "finance.spend.request", { teamId: KITCHEN })).toBe(false);
  });
});
