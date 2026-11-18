// CSV import against the database: dry run, apply, idempotency, duplicates, capacity, audit.
// docs/specs/b1-people-teams-roles.md §4 I2–I8.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { ForbiddenError } from "@/base/errors";
import { getPersonView } from "@/base/people/directory";
import { applyImport, planImport } from "@/base/people/import/import";
import { editionMembers, editions, invites, people } from "@/base/schema";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;
const CSV = [
  "Email,First name,Surname,Playa name,Status,Deposit,Arrival,Departure,Build,Diet,Allergies",
  "new.one@example.test,New,One,Sprocket,confirmed,deposit paid,2027-04-21,2027-05-04,yes,vegan,",
  "GIFT@example.test,,,Glitter,,paid,,,partial,,sesame",
  "kitchen@example.test,,,,,,,,,,",
  "other.cook@example.test,Cook,,,waitlisted,,,,,,",
  "bad-email,Bad,Row,,confirmed,,,,,,",
  "new.one@example.test,Again,,,,,,,,,",
  "pal@example.test,Pal,Xample,,maybe,,,,,,",
].join("\n");
const input = (over: object = {}) => ({ csv: CSV, fileName: "sheet.csv", ...over });
const countPeople = async () => (await getDb().select().from(people)).length;

describe("CSV member import", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("I2: a dry run reports every row and writes nothing", async () => {
    const before = await countPeople();
    const report = await planImport(await as(ids.admin), input());
    expect(report.rows.map((r) => [r.line, r.action])).toEqual([
      [2, "create"],
      [3, "update"],
      [4, "unchanged"],
      [5, "duplicate"],
      [6, "error"],
      [7, "error"],
      [8, "error"],
    ]);
    expect(report.rows[1]?.changes).toEqual([
      "playaName",
      "paymentStatus",
      "buildCommitment",
      "allergies",
    ]);
    expect(report.rows[3]?.candidates?.map((c) => c.displayName)).toEqual(["Cook"]);
    expect(report.rows[4]?.issues).toEqual(["invalid email"]);
    expect(report.rows[5]?.issues).toEqual(["email appears earlier in the file (line 2)"]);
    expect(report.rows[6]?.issues).toEqual(['unknown status "maybe"']);
    expect(report.counts).toEqual({ create: 1, update: 1, unchanged: 1, duplicate: 1, error: 3 });
    expect(await countPeople()).toBe(before);
    expect(await getDb().select().from(baseTables.auditEvents)).toHaveLength(0);
  });

  it("I3/I4: apply writes creates and updates once, audits counts only, and is idempotent", async () => {
    const before = await countPeople();
    const first = await applyImport(await as(ids.admin), input());
    expect(first.applied).toEqual({ created: 1, updated: 1, skipped: 4 });
    expect(await countPeople()).toBe(before + 1);
    const gift = await getPersonView(await as(ids.admin), ids.gift);
    expect(gift).toMatchObject({ playaName: "Glitter", payment: { status: "paid_in_full" } });
    expect(gift.dietary).toEqual({ diet: "vegan", allergies: "sesame" });
    const [audit] = await getDb().select().from(baseTables.auditEvents);
    expect(audit).toMatchObject({
      action: "member.import_applied",
      actorKind: "import",
      actorPersonId: ids.admin,
      changes: { fileName: "sheet.csv", created: 1, updated: 1, skipped: 4 },
    });
    expect(JSON.stringify(audit?.changes)).not.toMatch(/sesame|example\.test/);

    const again = await applyImport(await as(ids.admin), input());
    expect(again.applied).toEqual({ created: 0, updated: 0, skipped: 4 });
    expect(again.counts.unchanged).toBe(3);
    expect(await countPeople()).toBe(before + 1);
  });

  it("I5: a possible duplicate is only imported once resolved", async () => {
    const admin = await as(ids.admin);
    await applyImport(admin, input({ resolutions: { 5: { link: ids.cook } } }));
    const [cook] = await getDb().select().from(people).where(eq(people.id, ids.cook));
    expect(cook?.email).toBe("cook@example.test");
    expect((await getPersonView(admin, ids.cook)).status).toBe("waitlisted");
    expect(
      await getDb().select().from(people).where(eq(people.email, "other.cook@example.test")),
    ).toEqual([]);

    const fresh = await peopleFixture();
    await applyImport(await as(fresh.admin), input({ resolutions: { 5: "create" } }));
    expect(
      await getDb().select().from(people).where(eq(people.email, "other.cook@example.test")),
    ).toHaveLength(1);
  });

  it("I5: two new rows with the same name are both flagged", async () => {
    const csv = "Email,Name\na1@example.test,Sam Sample\na2@example.test,sam sample";
    const report = await planImport(await as(ids.admin), { csv, fileName: "x.csv" });
    expect(report.rows.map((r) => r.action)).toEqual(["create", "duplicate"]);
  });

  it("I6: going over capacity warns but doesn't block", async () => {
    await getDb().update(editions).set({ memberCapacity: 7 }).where(eq(editions.id, EDITION.id));
    const report = await applyImport(await as(ids.admin), input());
    expect(report.warnings).toEqual([
      "This import takes confirmed members to 8, over the capacity of 7.",
    ]);
    expect(report.applied.created).toBe(1);
  });

  it("I7: importing never sends invites; new people get this year's record", async () => {
    await applyImport(await as(ids.admin), input());
    expect(await getDb().select().from(invites)).toEqual([]);
    const [p] = await getDb().select().from(people).where(eq(people.email, "new.one@example.test"));
    const [m] = await getDb()
      .select()
      .from(editionMembers)
      .where(eq(editionMembers.personId, p?.id ?? ""));
    expect(m).toMatchObject({ status: "confirmed", importSource: "sheet.csv", diet: "vegan" });
    expect(p).toMatchObject({ displayName: "New One", playaName: "Sprocket" });
  });

  it("I1: an explicit mapping overrides the guess", async () => {
    const csv = "Contact,Who\nz@example.test,Zed Example";
    const report = await planImport(await as(ids.admin), {
      csv,
      fileName: "x.csv",
      mapping: ["email", "fullName"],
    });
    expect(report.mapping).toEqual(["email", "fullName"]);
    expect(report.rows[0]).toMatchObject({ action: "create", displayName: "Zed Example" });
    await expect(
      planImport(await as(ids.admin), { csv, fileName: "x.csv", mapping: [null, "fullName"] }),
    ).rejects.toThrow(/email column/);
  });

  it("I8 (deny): non-admins can't dry-run or apply", async () => {
    for (const who of [ids.camp, ids.lead, ids.kitchen]) {
      await expect(planImport(await as(who), input())).rejects.toBeInstanceOf(ForbiddenError);
      await expect(applyImport(await as(who), input())).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(
      await getDb().select().from(people).where(eq(people.email, "new.one@example.test")),
    ).toEqual([]);
  });
});
