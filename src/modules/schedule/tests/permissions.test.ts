import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "schedule.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "schedule.manage": {
    allow: ["camp_lead", "admin"],
    deny: ["member", "team_lead", "finance_approver", "waitlisted"],
  },
});

describe("schedule_lead", () => {
  it("manages when confirmed for the year, not otherwise", () => {
    expect(can(persona("member", { roles: ["schedule_lead"] }), "schedule.manage")).toBe(true);
    expect(can(persona("waitlisted", { roles: ["schedule_lead"] }), "schedule.manage")).toBe(false);
  });
});
