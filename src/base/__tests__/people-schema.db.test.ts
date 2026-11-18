// B1 schema (docs/specs/b1-people-teams-roles.md §1): defaults and the constraints the database
// enforces on its own, whatever the app code does.
import { and, eq, getTableName } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import {
  anchorDates,
  availabilityWindows,
  editionMembers,
  memberAdminNotes,
  personSkills,
  skills,
  teams,
} from "@/base/schema";
import { firstRow } from "@/lib/rows";

async function memberRow(personId: string) {
  return firstRow(
    await getDb()
      .select()
      .from(editionMembers)
      .where(and(eq(editionMembers.personId, personId), eq(editionMembers.editionId, EDITION.id))),
    "member",
  );
}

describe("B1 people schema", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("a new member record starts with safe defaults", async () => {
    const row = await memberRow(await createPerson({ email: "a@example.test", name: "A" }));
    expect(row).toMatchObject({
      paymentStatus: "unknown",
      buildCommitment: "none",
      strikeCommitment: "none",
      tentChoice: "undecided",
      arrivalConfirmed: false,
      diet: null,
      allergies: null,
    });
  });

  it("refuses a departure before the arrival", async () => {
    const row = await memberRow(await createPerson({ email: "b@example.test", name: "B" }));
    await expect(
      getDb()
        .update(editionMembers)
        .set({
          arrivalAt: new Date("2027-04-20T08:00:00Z"),
          departureAt: new Date("2027-04-19T08:00:00Z"),
        })
        .where(eq(editionMembers.id, row.id)),
    ).rejects.toThrow();
    await getDb()
      .update(editionMembers)
      .set({
        arrivalAt: new Date("2027-04-20T08:00:00Z"),
        departureAt: new Date("2027-05-03T08:00:00Z"),
      })
      .where(eq(editionMembers.id, row.id));
    expect((await memberRow(row.personId)).departureAt?.toISOString()).toBe(
      "2027-05-03T08:00:00.000Z",
    );
  });

  it("one anchor date per key per edition", async () => {
    const values = {
      editionId: EDITION.id,
      key: "build_start",
      label: "Build starts",
      startsAt: new Date("2027-04-21T06:00:00Z"),
    };
    await getDb().insert(anchorDates).values(values);
    await expect(getDb().insert(anchorDates).values(values)).rejects.toThrow();
  });

  it("a skill is held once per person", async () => {
    const personId = await createPerson({ email: "c@example.test", name: "C" });
    const skill = firstRow(
      await getDb().insert(skills).values({ key: "carpentry", label: "Carpentry" }).returning(),
    );
    await getDb().insert(personSkills).values({ personId, skillId: skill.id });
    await expect(
      getDb().insert(personSkills).values({ personId, skillId: skill.id }),
    ).rejects.toThrow();
  });

  it("availability windows must end on or after they start", async () => {
    const row = await memberRow(await createPerson({ email: "d@example.test", name: "D" }));
    await expect(
      getDb()
        .insert(availabilityWindows)
        .values({ editionMemberId: row.id, startsOn: "2027-04-10", endsOn: "2027-04-09" }),
    ).rejects.toThrow();
    await getDb()
      .insert(availabilityWindows)
      .values({ editionMemberId: row.id, startsOn: "2027-04-10", endsOn: "2027-04-10" });
    expect(await getDb().select().from(availabilityWindows)).toHaveLength(1);
  });

  it("admin notes and sub-teams point at real rows", async () => {
    await expect(
      getDb()
        .insert(memberAdminNotes)
        .values({ editionMemberId: "01900000-0000-7000-8000-0000000fffff", body: "x" }),
    ).rejects.toThrow();
    await expect(
      getDb().insert(teams).values({
        editionId: EDITION.id,
        key: "power",
        name: "Power",
        parentTeamId: "01900000-0000-7000-8000-0000000fffff",
      }),
    ).rejects.toThrow();
  });

  it("declares its foreign keys to the right tables", () => {
    const targets = (t: PgTable) =>
      getTableConfig(t)
        .foreignKeys.map((fk) => {
          const ref = fk.reference();
          return `${ref.columns.map((c) => c.name).join()}->${getTableName(ref.foreignTable)}`;
        })
        .sort();
    expect(targets(teams)).toEqual(["edition_id->editions", "parent_team_id->teams"]);
    expect(targets(anchorDates)).toEqual(["edition_id->editions"]);
    expect(targets(memberAdminNotes)).toEqual([
      "author_person_id->people",
      "edition_member_id->edition_members",
    ]);
    expect(targets(personSkills)).toEqual([
      "person_id->people",
      "skill_id->skills",
      "verified_by_person_id->people",
    ]);
    expect(targets(availabilityWindows)).toEqual(["edition_member_id->edition_members"]);
  });
});
