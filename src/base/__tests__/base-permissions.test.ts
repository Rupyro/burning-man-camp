// Allow and deny cases for every base capability (docs/specs/b1-people-teams-roles.md §3, §4 P1–P9).
// The first test fails if a base capability is added without cases here.
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import type { Actor } from "@/base/authz/actor";
import { BASE_CAPABILITIES, can } from "@/base/authz/permissions";

const KITCHEN = "01900000-0000-7000-8000-00000000a001"; // team_lead persona leads this (key "kitchen")
const GIFTS = "01900000-0000-7000-8000-00000000a002";
const other = "01900000-0000-7000-8000-0000000000ff";

const member = persona("member");
const kitchenLead = persona("team_lead");
const kitchenCoLead = persona("member", {
  teams: [{ teamId: KITCHEN, teamKey: "kitchen", role: "co_lead" }],
});
const kitchenMember = persona("member", {
  teams: [{ teamId: KITCHEN, teamKey: "kitchen", role: "member" }],
});
const dietViewer = persona("member", { roles: ["kitchen_sensitive_viewer"] });
const campLead = persona("camp_lead");
const finance = persona("finance_approver");
const admin = persona("admin", { memberStatus: null });
const waitlisted = persona("waitlisted");
const alumni = persona("alumni");
/** P8: three teams, two roles; P9: still no camp-wide powers from leading a team. */
const busy = persona("member", {
  roles: ["lnt_lead", "kitchen_sensitive_viewer"],
  teams: [
    { teamId: KITCHEN, teamKey: "kitchen", role: "member" },
    { teamId: GIFTS, teamKey: "gift_projects", role: "lead" },
    { teamId: "t-moop", teamKey: "moop", role: "member" },
  ],
});

type Case = [label: string, actor: Actor, resource?: unknown];
const someone = (over: object = {}) => ({ personId: other, ...over });
const self = (a: Actor) => ({ personId: a.personId ?? "" });

const MATRIX: Record<(typeof BASE_CAPABILITIES)[number], { allow: Case[]; deny: Case[] }> = {
  "admin.settings": { allow: [["admin", admin]], deny: [["camp lead", campLead]] },
  "member.view_directory": {
    allow: [
      ["confirmed member", member],
      ["member, visible person", member, someone({ visibility: "members" })],
      ["admin, hidden person", admin, someone({ visibility: "hidden" })],
      ["self, hidden", member, { ...self(member), visibility: "hidden" }],
      ["their lead, hidden", kitchenLead, someone({ visibility: "hidden", teamIds: [KITCHEN] })],
    ],
    deny: [
      ["waitlisted", waitlisted],
      ["alumni (not this year)", alumni],
      ["member, hidden person", member, someone({ visibility: "hidden", teamIds: [KITCHEN] })],
      [
        "other team's lead, hidden",
        kitchenLead,
        someone({ visibility: "hidden", teamIds: [GIFTS] }),
      ],
    ],
  },
  "member.view_contacts": {
    allow: [
      ["admin", admin, someone()],
      ["self", member, self(member)],
      ["lead of their team", kitchenLead, someone({ teamIds: [KITCHEN] })],
      ["co-lead of their team (by key)", kitchenCoLead, someone({ teamIds: ["kitchen"] })],
      ["member, person shares contact", member, someone({ visibility: "members_with_contact" })],
    ],
    deny: [
      ["member", member, someone({ teamIds: [KITCHEN] })],
      ["team-mate (not lead)", kitchenMember, someone({ teamIds: [KITCHEN] })],
      ["lead of another team", kitchenLead, someone({ teamIds: [GIFTS] })],
      ["lead, no team info", kitchenLead, someone()],
      [
        "waitlisted, person shares contact",
        waitlisted,
        someone({ visibility: "members_with_contact" }),
      ],
    ],
  },
  "member.view_dietary": {
    allow: [
      ["self", member, self(member)],
      ["diet viewer role", dietViewer, someone()],
      ["admin", admin, someone()],
    ],
    deny: [
      ["member", member, someone()],
      ["kitchen lead without the role", kitchenLead, someone({ teamIds: [KITCHEN] })],
      ["camp lead", campLead, someone()],
    ],
  },
  "member.view_payment": {
    allow: [
      ["self", member, self(member)],
      ["finance approver", finance, someone()],
      ["admin", admin, someone()],
    ],
    deny: [
      ["member", member, someone()],
      ["team lead", kitchenLead, someone({ teamIds: [KITCHEN] })],
    ],
  },
  "member.edit_profile": {
    allow: [
      ["self", member, self(member)],
      ["self, waitlisted", waitlisted, self(waitlisted)],
      ["camp lead", campLead, someone()],
      ["admin", admin, someone()],
    ],
    deny: [
      ["member, someone else", member, someone()],
      ["their lead", kitchenLead, someone({ teamIds: [KITCHEN] })],
      ["self, no record this year", alumni, self(alumni)],
    ],
  },
  "member.manage": {
    allow: [
      ["camp lead", campLead],
      ["admin", admin],
    ],
    deny: [
      ["member", member],
      ["team lead", kitchenLead],
      ["busy lead with two roles", busy],
    ],
  },
  "member.admin_notes": {
    allow: [["admin", admin]],
    deny: [
      ["camp lead", campLead],
      ["member", member],
    ],
  },
  "member.import": {
    allow: [["admin", admin]],
    deny: [
      ["camp lead", campLead],
      ["team lead", kitchenLead],
    ],
  },
  "team.manage": {
    allow: [
      ["camp lead", campLead],
      ["admin", admin],
    ],
    deny: [
      ["team lead", kitchenLead],
      ["member", member],
    ],
  },
  "team.manage_members": {
    allow: [
      ["lead adds a member", kitchenLead, { teamId: KITCHEN, role: "member" }],
      ["co-lead adds a co-lead", kitchenCoLead, { teamId: "kitchen", role: "co_lead" }],
      ["camp lead appoints a lead", campLead, { teamId: KITCHEN, role: "lead" }],
      ["admin", admin, { teamId: GIFTS, role: "lead" }],
    ],
    deny: [
      ["lead appoints a lead", kitchenLead, { teamId: KITCHEN, role: "lead" }],
      ["lead of another team", kitchenLead, { teamId: GIFTS, role: "member" }],
      ["team-mate", kitchenMember, { teamId: KITCHEN, role: "member" }],
      ["lead, no team given", kitchenLead],
    ],
  },
  "role.assign": {
    allow: [["admin", admin, { roleKey: "finance_approver" }]],
    deny: [
      ["camp lead", campLead, { roleKey: "finance_approver" }],
      ["busy lead", busy, { roleKey: "admin" }],
    ],
  },
  "edition.manage": {
    allow: [
      ["camp lead", campLead],
      ["admin", admin],
    ],
    deny: [
      ["team lead", kitchenLead],
      ["finance approver", finance],
    ],
  },
  "task.edit": {
    allow: [
      ["member", member],
      ["admin not in this year", admin],
      // B2 (docs/specs/b2-task-engine.md §3): with a task, the owner or a lead of its team
      ["owner of the task", member, { teamId: GIFTS, ownerPersonId: member.personId }],
      ["lead of the task's team", kitchenLead, { teamId: KITCHEN, ownerPersonId: other }],
      ["camp lead, any task", campLead, { teamId: GIFTS, ownerPersonId: other }],
    ],
    deny: [
      ["waitlisted", waitlisted],
      ["member, someone else's task", member, { teamId: KITCHEN, ownerPersonId: other }],
      ["team-mate, not owner", kitchenMember, { teamId: KITCHEN, ownerPersonId: other }],
      ["lead of another team", kitchenLead, { teamId: GIFTS, ownerPersonId: other }],
      ["waitlisted owner", waitlisted, { teamId: GIFTS, ownerPersonId: waitlisted.personId }],
    ],
  },
  "task.claim": { allow: [["member", member]], deny: [["waitlisted", waitlisted]] },
  "task.view": {
    allow: [
      ["member", member],
      ["admin not in this year", admin],
    ],
    deny: [
      ["waitlisted", waitlisted],
      ["alumni", alumni],
    ],
  },
  "task.comment": {
    allow: [
      ["member", member],
      ["admin", admin],
    ],
    deny: [["waitlisted", waitlisted]],
  },
  "task.create": {
    allow: [
      ["team-mate", kitchenMember, { teamId: KITCHEN }],
      ["lead (by key)", kitchenLead, { teamId: "kitchen" }],
      ["camp lead, any team", campLead, { teamId: GIFTS }],
      ["admin", admin, { teamId: GIFTS }],
    ],
    deny: [
      ["member of no team", member, { teamId: KITCHEN }],
      ["member of another team", kitchenMember, { teamId: GIFTS }],
      ["no team given", kitchenMember],
      [
        "waitlisted team-mate",
        persona("waitlisted", { teams: [{ teamId: KITCHEN, teamKey: "kitchen", role: "member" }] }),
        { teamId: KITCHEN },
      ],
    ],
  },
  "task.manage": {
    allow: [
      ["lead", kitchenLead, { teamId: KITCHEN }],
      ["co-lead", kitchenCoLead, { teamId: KITCHEN }],
      ["camp lead", campLead, { teamId: GIFTS }],
      ["admin", admin, { teamId: GIFTS }],
    ],
    deny: [
      ["team-mate", kitchenMember, { teamId: KITCHEN }],
      ["lead of another team", kitchenLead, { teamId: GIFTS }],
      ["lead, no team given", kitchenLead],
    ],
  },
  "project.manage": {
    allow: [
      ["lead", kitchenLead, { teamId: KITCHEN }],
      ["camp lead", campLead, { teamId: GIFTS }],
    ],
    deny: [
      ["team-mate", kitchenMember, { teamId: KITCHEN }],
      ["lead of another team", kitchenLead, { teamId: GIFTS }],
    ],
  },
  "readiness.view": {
    allow: [
      ["camp lead, whole camp", campLead],
      ["admin", admin],
      ["lead, own team", kitchenLead, { teamId: KITCHEN }],
      ["lead, no team given (their teams)", kitchenLead],
    ],
    deny: [
      ["member", member],
      ["team-mate", kitchenMember, { teamId: KITCHEN }],
      ["lead of another team", kitchenLead, { teamId: GIFTS }],
    ],
  },
};

describe("base capabilities", () => {
  it("every base capability has at least one allow and one deny case", () => {
    for (const cap of BASE_CAPABILITIES) {
      expect(MATRIX[cap]?.allow.length, `${cap} allow`).toBeGreaterThan(0);
      expect(MATRIX[cap]?.deny.length, `${cap} deny`).toBeGreaterThan(0);
    }
  });

  for (const [cap, { allow, deny }] of Object.entries(MATRIX)) {
    it.each(allow)(`${cap}: allows %s`, (_label, actor, resource) => {
      expect(can(actor, cap as `${string}.${string}`, resource)).toBe(true);
    });
    it.each(deny)(`${cap}: denies %s`, (_label, actor, resource) => {
      expect(can(actor, cap as `${string}.${string}`, resource)).toBe(false);
    });
  }

  it("P8: three teams and two roles add up", () => {
    expect(busy.teams).toHaveLength(3);
    expect(busy.roles.size).toBe(2);
    expect(can(busy, "member.view_dietary", someone())).toBe(true);
    expect(can(busy, "team.manage_members", { teamId: GIFTS, role: "member" })).toBe(true);
    expect(can(busy, "team.manage_members", { teamId: KITCHEN, role: "member" })).toBe(false);
    expect(can(busy, "member.view_contacts", someone({ teamIds: ["gift_projects"] }))).toBe(true);
  });
});
