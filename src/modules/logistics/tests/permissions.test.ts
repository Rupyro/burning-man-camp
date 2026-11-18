// docs/specs/logistics.md §4: every capability, allow and deny, plus the Logistics-team cases.
import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

const LOGISTICS = "01900000-0000-7000-8000-00000000a0b0";
const onLogistics = (role: "lead" | "member") =>
  persona("member", { teams: [{ teamId: LOGISTICS, teamKey: "logistics", role }] });

permissionMatrix(manifest, {
  "logistics.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "logistics.travel.edit": {
    allow: ["member", "team_lead", "camp_lead"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "logistics.ride.ask": {
    allow: ["member", "camp_lead"],
    deny: ["waitlisted", "alumni"],
  },
  "logistics.loads.manage": {
    allow: ["camp_lead"],
    deny: ["member", "team_lead", "admin", "finance_approver", "waitlisted"],
  },
  "logistics.delivery.confirm": {
    allow: ["team_lead", "camp_lead"],
    deny: ["member", "admin", "waitlisted"],
  },
  "logistics.export": {
    allow: ["camp_lead", "admin"],
    deny: ["member", "team_lead", "finance_approver"],
  },
});

describe("logistics team checks", () => {
  it("the Logistics team manages loads and confirms deliveries; only its leads export (L1, L2, L7)", () => {
    const member = onLogistics("member");
    const lead = onLogistics("lead");
    expect(can(member, "logistics.loads.manage")).toBe(true);
    expect(can(member, "logistics.delivery.confirm")).toBe(true);
    expect(can(member, "logistics.export")).toBe(false);
    expect(can(lead, "logistics.export")).toBe(true);
  });
  it("a waitlisted Logistics lead can't do anything but look", () => {
    const w = persona("waitlisted", {
      teams: [{ teamId: LOGISTICS, teamKey: "logistics", role: "lead" }],
    });
    expect(can(w, "logistics.loads.manage")).toBe(false);
    expect(can(w, "logistics.export")).toBe(false);
    expect(can(w, "logistics.travel.edit")).toBe(false);
  });
});
