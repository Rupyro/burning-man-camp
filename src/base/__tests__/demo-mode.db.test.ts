// Demo mode safety and persona permissions (docs/specs/b3-demo-mode.md).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  addTeam,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { can } from "@/base/authz/permissions";
import { demoStatus, requireDemo } from "@/base/demo/mode";
import { personaIds, seedPersonas } from "@/base/demo/seed-personas";
import { ForbiddenError } from "@/base/errors";

const saved = process.env.DEMO_MODE;
afterEach(() => {
  if (saved === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = saved;
});

describe("demo mode", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    await seedPersonas(getDb(), EDITION.id);
  });

  it("off by default: the role picker is unreachable", async () => {
    delete process.env.DEMO_MODE;
    expect(await demoStatus(getDb())).toEqual({ on: false, reason: "flag_off" });
    await expect(requireDemo(getDb())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("on with the flag and an all-fake database", async () => {
    process.env.DEMO_MODE = "true";
    expect(await demoStatus(getDb())).toEqual({ on: true });
    await expect(requireDemo(getDb())).resolves.toBeUndefined();
  });

  it("refuses when a real (non example.test) member exists", async () => {
    process.env.DEMO_MODE = "true";
    await createPerson({ email: "someone@gmail.com", name: "Real Person" });
    expect(await demoStatus(getDb())).toEqual({ on: false, reason: "real_people" });
    await expect(requireDemo(getDb())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses when the personas were never seeded", async () => {
    process.env.DEMO_MODE = "true";
    await truncateAll();
    await createCamp();
    expect(await demoStatus(getDb())).toEqual({ on: false, reason: "not_seeded" });
  });

  it("seeding personas twice is harmless", async () => {
    await seedPersonas(getDb(), EDITION.id);
    expect(Object.keys(await personaIds(getDb()))).toHaveLength(7);
  });

  it("the Applicant persona is a prospect (an applicant); everyone else is a confirmed member", async () => {
    const ids = await personaIds(getDb());
    const kai = await actorFor(ids.applicant);
    expect(kai.memberStatus).toBe("prospect");
    expect(kai.isApplicant).toBe(true);
    // The New applicant persona (Sage, 21 Oct 2026) is an applicant too.
    expect((await actorFor(ids.new_applicant)).isApplicant).toBe(true);
    for (const key of ["member", "kitchen_lead", "diet_viewer", "finance_approver"] as const)
      expect((await actorFor(ids[key])).isConfirmedMember).toBe(true);
    // A second seed puts a joined demo applicant back at the start.
    await seedPersonas(getDb(), EDITION.id);
    expect((await actorFor(ids.applicant)).isApplicant).toBe(true);
  });

  it("each persona has exactly its own powers", async () => {
    const ids = await personaIds(getDb());
    const actor = async (k: keyof typeof ids) => actorFor(ids[k]);
    const member = await actor("member");
    const lead = await actor("kitchen_lead");
    const diet = await actor("diet_viewer");
    const admin = await actor("admin");
    const kitchen = lead.teams.find((t) => t.teamKey === "kitchen")?.teamId ?? "";
    const someoneElse = { personId: ids.admin, teamIds: [] };

    expect(can(member, "task.view")).toBe(true);
    expect(can(member, "readiness.view")).toBe(false);
    expect(can(member, "member.view_dietary", someoneElse)).toBe(false);
    expect(can(member, "edition.manage")).toBe(false);

    expect(can(lead, "readiness.view", { teamId: kitchen })).toBe(true);
    expect(can(lead, "task.manage", { teamId: kitchen, ownerPersonId: null })).toBe(true);
    expect(can(lead, "member.view_dietary", someoneElse)).toBe(false);
    expect(can(lead, "edition.manage")).toBe(false);

    expect(can(diet, "member.view_dietary", someoneElse)).toBe(true);
    expect(can(diet, "readiness.view")).toBe(false);
    expect(can(diet, "edition.manage")).toBe(false);

    expect(can(admin, "edition.manage")).toBe(true);
    expect(can(admin, "member.import")).toBe(true);
  });

  it("the finance approver persona holds the finance_approver role and leads Finance", async () => {
    await addTeam("finance", "Finance");
    await seedPersonas(getDb(), EDITION.id);
    const ids = await personaIds(getDb());
    const jules = await actorFor(ids.finance_approver);
    expect(jules.hasRole("finance_approver")).toBe(true);
    expect(jules.teams.find((t) => t.teamKey === "finance")?.role).toBe("lead");
    expect(can(jules, "edition.manage")).toBe(false);
    expect((await actorFor(ids.member)).hasRole("finance_approver")).toBe(false);
  });
});
