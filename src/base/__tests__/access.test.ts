import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { audienceAllows, evaluateAccess } from "@/base/authz/access";
import { Actor } from "@/base/authz/actor";
import { can } from "@/base/authz/permissions";

describe("evaluateAccess", () => {
  it("everyone = confirmed members of the current edition", () => {
    expect(evaluateAccess(persona("member"), [{ everyone: true }])).toBe(true);
    expect(evaluateAccess(persona("waitlisted"), [{ everyone: true }])).toBe(false);
    expect(evaluateAccess(persona("alumni"), [{ everyone: true }])).toBe(false);
  });

  it("matches roles, team membership/role and any-team-lead", () => {
    expect(evaluateAccess(persona("camp_lead"), [{ role: "camp_lead" }])).toBe(true);
    expect(evaluateAccess(persona("member"), [{ role: "camp_lead" }])).toBe(false);
    expect(evaluateAccess(persona("team_lead"), [{ team: "kitchen", teamRoles: ["lead"] }])).toBe(
      true,
    );
    expect(evaluateAccess(persona("team_lead"), [{ team: "kitchen", teamRoles: ["member"] }])).toBe(
      false,
    );
    expect(evaluateAccess(persona("team_lead"), [{ anyTeamLead: true }])).toBe(true);
    expect(evaluateAccess(persona("member"), [{ anyTeamLead: true }])).toBe(false);
  });

  it("admins see every module; the system actor sees none", () => {
    expect(evaluateAccess(persona("admin", { memberStatus: null }), [{ role: "camp_lead" }])).toBe(
      true,
    );
    expect(evaluateAccess(Actor.system(), [{ everyone: true }])).toBe(false);
  });

  it("audience: pilot only for pilot holders, admins only for admins", () => {
    expect(audienceAllows(persona("member"), "everyone")).toBe(true);
    expect(audienceAllows(persona("member"), "pilot")).toBe(false);
    expect(audienceAllows(persona("pilot"), "pilot")).toBe(true);
    expect(audienceAllows(persona("pilot"), "admins")).toBe(false);
    expect(audienceAllows(persona("admin"), "admins")).toBe(true);
  });
});

describe("can()", () => {
  it("denies unknown capabilities", () => {
    expect(can(persona("admin"), "nope.nothing")).toBe(false);
  });
  it("evaluates base capabilities", () => {
    expect(can(persona("admin"), "admin.settings")).toBe(true);
    expect(can(persona("member"), "admin.settings")).toBe(false);
  });
});
