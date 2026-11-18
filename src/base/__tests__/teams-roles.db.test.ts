// Teams, roles and the edition settings. docs/specs/b1-people-teams-roles.md §4 P6, P7, P9, M1, M2.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { actorFor, baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { listAnchorDates, setAnchorDate, updateEdition } from "@/base/editions/settings";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { capacityStatus } from "@/base/people/members";
import { grantRole, listRoleHolders, revokeRole } from "@/base/roles/roles";
import { editions, teams } from "@/base/schema";
import { createTeam, listTeams, removeTeamMember, setTeamMember } from "@/base/teams/teams";
import { firstRow } from "@/lib/rows";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;
let gifts: string;
let kitchen: string;
const audit = async (action: string) =>
  (await getDb().select().from(baseTables.auditEvents)).filter((a) => a.action === action);
const teamId = async (key: string) =>
  firstRow(
    await getDb()
      .select()
      .from(teams)
      .where(and(eq(teams.key, key), eq(teams.editionId, EDITION.id))),
  ).id;

describe("teams, roles, edition", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
    gifts = await teamId("gift_projects");
    kitchen = await teamId("kitchen");
  });

  it("lists teams with their people and roles for members", async () => {
    const list = await listTeams(await as(ids.kitchen));
    const g = list.find((t) => t.key === "gift_projects");
    expect(g?.members).toEqual([
      { personId: ids.lead, displayName: "Gift Lead", role: "lead" },
      { personId: ids.gift, displayName: "Gift Member", role: "member" },
    ]);
    await expect(listTeams(await as(ids.wait))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("P7: a team lead adds members and co-leads to their own team, audited", async () => {
    const ctx = await as(ids.lead);
    await setTeamMember(ctx, { teamId: gifts, personId: ids.kitchen, role: "member" });
    await setTeamMember(ctx, { teamId: gifts, personId: ids.kitchen, role: "co_lead" });
    expect((await actorFor(ids.kitchen)).isLeadOf("gift_projects")).toBe(true);
    expect((await audit("team.member_added"))[0]?.changes).toEqual({
      teamId: [null, gifts],
      role: [null, "member"],
    });
    expect((await audit("team.member_role_changed"))[0]?.changes).toEqual({
      role: ["member", "co_lead"],
    });
    await removeTeamMember(ctx, { teamId: gifts, personId: ids.kitchen });
    expect((await actorFor(ids.kitchen)).isMemberOf("gift_projects")).toBe(false);
    expect(await audit("team.member_removed")).toHaveLength(1);
    await setTeamMember(ctx, { teamId: gifts, personId: ids.kitchen, role: "member" });
    expect((await actorFor(ids.kitchen)).isMemberOf("gift_projects")).toBe(true);
  });

  it("P7 (deny): a lead can't appoint or demote a lead, or touch another team", async () => {
    const ctx = await as(ids.lead);
    await expect(
      setTeamMember(ctx, { teamId: gifts, personId: ids.kitchen, role: "lead" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setTeamMember(ctx, { teamId: kitchen, personId: ids.gift, role: "member" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await setTeamMember(await as(ids.camp), { teamId: gifts, personId: ids.camp, role: "lead" });
    await expect(
      setTeamMember(ctx, { teamId: gifts, personId: ids.camp, role: "member" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeTeamMember(await as(ids.gift), { teamId: gifts, personId: ids.lead }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("only camp leads create teams; keys are unique per edition", async () => {
    await expect(
      createTeam(await as(ids.lead), { key: "power", name: "Power" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const id = await createTeam(await as(ids.camp), {
      key: "power",
      name: "Power",
      parentTeamId: gifts,
    });
    expect((await listTeams(await as(ids.camp))).find((t) => t.id === id)?.parentTeamId).toBe(
      gifts,
    );
    await expect(
      createTeam(await as(ids.camp), { key: "power", name: "Again" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await audit("team.created")).toHaveLength(1);
  });

  it("P8/P9: an admin grants two roles; roles add up, leading a team adds no camp-wide power", async () => {
    const admin = await as(ids.admin);
    await grantRole(admin, { personId: ids.lead, roleKey: "camp_lead" });
    await grantRole(admin, { personId: ids.lead, roleKey: "kitchen_sensitive_viewer" });
    await grantRole(admin, { personId: ids.lead, roleKey: "camp_lead" }); // idempotent
    const lead = await actorFor(ids.lead);
    expect([...lead.roles].sort()).toEqual(["camp_lead", "kitchen_sensitive_viewer"]);
    expect(await audit("role.granted")).toHaveLength(2);
    expect((await audit("role.granted"))[0]).toMatchObject({ significance: "security" });
    expect((await listRoleHolders(admin)).filter((r) => r.personId === ids.lead)).toHaveLength(2);
    await revokeRole(admin, { personId: ids.lead, roleKey: "camp_lead" });
    expect([...(await actorFor(ids.lead)).roles]).toEqual(["kitchen_sensitive_viewer"]);
    expect(await audit("role.revoked")).toHaveLength(1);
  });

  it("P6/P9 (deny): only admins assign roles; nobody removes their own admin", async () => {
    await expect(
      grantRole(await as(ids.lead), { personId: ids.lead, roleKey: "admin" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      grantRole(await as(ids.camp), { personId: ids.gift, roleKey: "finance_approver" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      grantRole(await as(ids.admin), { personId: ids.gift, roleKey: "wizard" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      revokeRole(await as(ids.admin), { personId: ids.admin, roleKey: "admin" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("M1/M2: the camp lead sets capacity and anchor dates, audited; members can't", async () => {
    const camp = await as(ids.camp);
    await updateEdition(camp, { memberCapacity: 72 });
    expect((await capacityStatus(getDb(), EDITION.id)).capacity).toBe(72);
    expect((await audit("edition.updated"))[0]?.changes).toEqual({ memberCapacity: [null, 72] });
    await setAnchorDate(camp, {
      key: "build_start",
      label: "Build starts",
      startsAt: "2027-04-21T06:00:00Z",
      isConfirmed: false,
    });
    await setAnchorDate(camp, {
      key: "build_start",
      label: "Build starts",
      startsAt: "2027-04-22T06:00:00Z",
      isConfirmed: true,
    });
    const anchors = await listAnchorDates(getDb(), EDITION.id);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ key: "build_start", isConfirmed: true });
    expect(await audit("edition.anchor_set")).toHaveLength(2);
    const member = await as(ids.kitchen);
    await expect(updateEdition(member, { memberCapacity: 500 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      setAnchorDate(await as(ids.lead), {
        key: "x",
        label: "x",
        startsAt: "2027-01-01T00:00:00Z",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateEdition(camp, { memberCapacity: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const [ed] = await getDb().select().from(editions).where(eq(editions.id, EDITION.id));
    expect(ed?.memberCapacity).toBe(72);
  });
});
