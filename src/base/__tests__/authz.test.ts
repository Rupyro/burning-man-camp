import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { evaluateAccess } from "@/base/authz/access";
import { Actor } from "@/base/authz/actor";
import { can, definePermissions, isCapabilityDefined } from "@/base/authz/permissions";

describe("Actor", () => {
  it("knows the system actor", () => {
    const system = Actor.system("ed");
    expect(system.isSystem).toBe(true);
    expect(system.editionId).toBe("ed");
    expect(Actor.system().editionId).toBeNull();
    expect(persona("member").isSystem).toBe(false);
  });

  it("answers team questions by team id or key", () => {
    const lead = persona("team_lead");
    const [team] = lead.teams;
    expect(lead.isMemberOf("kitchen")).toBe(true);
    expect(lead.isMemberOf(team!.teamId)).toBe(true);
    expect(lead.isMemberOf("logistics")).toBe(false);
    expect(lead.isLeadOf("kitchen")).toBe(true);
    expect(lead.isLeadOf("logistics")).toBe(false);
    expect(lead.teamRole("kitchen")).toBe("lead");
    expect(lead.teamRole("logistics")).toBeNull();
  });

  it("a plain team member is not a lead; a co-lead is", () => {
    const member = persona("member", {
      teams: [{ teamId: "t1", teamKey: "kitchen", role: "member" }],
    });
    expect(member.isLeadOf("kitchen")).toBe(false);
    expect(member.isAnyTeamLead).toBe(false);
    const coLead = persona("member", {
      teams: [{ teamId: "t1", teamKey: "kitchen", role: "co_lead" }],
    });
    expect(coLead.isLeadOf("kitchen")).toBe(true);
    expect(coLead.isAnyTeamLead).toBe(true);
  });
});

describe("definePermissions", () => {
  it("rejects capabilities outside the module's namespace", () => {
    expect(() => definePermissions("authztest", { "other.thing.do": () => true })).toThrow(
      /must start with "authztest\."/,
    );
  });

  it("rejects redefining a base capability", () => {
    expect(() => definePermissions("admin", { "admin.settings": () => true })).toThrow(
      /base capability/,
    );
  });

  it("rejects a capability already owned by another module", () => {
    definePermissions("authzowner", { "authzowner.thing.do": () => true });
    expect(() => definePermissions("base", { "authzowner.thing.do": () => true })).toThrow(
      /already defined by "authzowner"/,
    );
  });

  it("lets the same owner re-register (hot reload) and reports defined capabilities", () => {
    definePermissions("authzreload", { "authzreload.x.do": () => true });
    expect(() =>
      definePermissions("authzreload", { "authzreload.x.do": () => false }),
    ).not.toThrow();
    expect(isCapabilityDefined("authzreload.x.do")).toBe(true);
    expect(isCapabilityDefined("authzreload.nope")).toBe(false);
  });
});

describe("can", () => {
  it("denies unknown capabilities", () => {
    expect(can(persona("admin"), "nobody.thing.do")).toBe(false);
  });

  it("denies when the check throws or returns a non-boolean", () => {
    definePermissions("authzthrow", {
      "authzthrow.x.do": () => {
        throw new Error("boom");
      },
      "authzthrow.y.do": () => 1 as unknown as boolean,
    });
    expect(can(persona("admin"), "authzthrow.x.do")).toBe(false);
    expect(can(persona("admin"), "authzthrow.y.do")).toBe(false);
  });

  it("base capabilities", () => {
    expect(can(persona("admin"), "admin.settings")).toBe(true);
    expect(can(persona("camp_lead"), "admin.settings")).toBe(false);

    const member = persona("member");
    expect(can(member, "member.view_contacts")).toBe(false);
    expect(can(member, "member.view_contacts", { personId: member.personId })).toBe(true);
    expect(can(member, "member.view_contacts", { personId: "someone-else" })).toBe(false);
    expect(can(persona("team_lead"), "member.view_contacts")).toBe(true);
    expect(can(persona("admin"), "member.view_contacts")).toBe(true);

    expect(can(member, "task.edit")).toBe(true);
    expect(can(persona("admin", { memberStatus: null }), "task.edit")).toBe(true);
    expect(can(persona("waitlisted"), "task.edit")).toBe(false);
    expect(can(member, "task.claim")).toBe(true);
    expect(can(persona("waitlisted"), "task.claim")).toBe(false);
  });
});

describe("evaluateAccess edge rules", () => {
  it("capability rules defer to can(); unknown rule shapes deny", () => {
    expect(evaluateAccess(persona("member"), [{ capability: "task.claim" }])).toBe(true);
    expect(evaluateAccess(persona("member"), [{ capability: "admin.settings" }])).toBe(false);
    expect(evaluateAccess(persona("member"), [{ bogus: true } as never])).toBe(false);
    expect(evaluateAccess(persona("team_lead"), [{ team: "kitchen" }])).toBe(true);
    expect(evaluateAccess(persona("member"), [{ team: "kitchen" }])).toBe(false);
  });
});
