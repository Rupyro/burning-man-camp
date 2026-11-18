// People, write side: own-profile edits, member status and capacity, admin notes.
// docs/specs/b1-people-teams-roles.md §4 P6, F1–F3, M1–M3.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { baseTables, createPerson, EDITION, getDb } from "@/base/api/testing-db";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { getPersonView } from "@/base/people/directory";
import { addAdminNote, setMemberStatus, updateProfile } from "@/base/people/members";
import { editions } from "@/base/schema";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

const audits = () => getDb().select().from(baseTables.auditEvents);

let ids: PeopleIds;

describe("people: profile edits, status, notes", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("F1: a member edits their own profile; private values are redacted in the audit", async () => {
    await updateProfile(await as(ids.kitchen), ids.kitchen, {
      playaName: "Sparkplug",
      phone: "+27820000009",
      countryCode: "za",
      arrivalAt: "2027-04-21T08:00:00Z",
      departureAt: "2027-05-04T10:00:00Z",
      buildCommitment: "full",
      strikeCommitment: "partial",
      tentChoice: "byo_tent",
      diet: "vegetarian",
      allergies: "shellfish",
      skills: ["first_aid", "carpentry"],
      availabilityWindows: [{ startsOn: "2027-03-01", endsOn: "2027-03-31", kind: "available" }],
    });
    const view = await getPersonView(await as(ids.kitchen), ids.kitchen);
    expect(view).toMatchObject({
      playaName: "Sparkplug",
      countryCode: "ZA",
      travel: { buildCommitment: "full", strikeCommitment: "partial", tentChoice: "byo_tent" },
      skills: ["Carpentry", "First aid"],
    });
    expect(view.travel.arrivalAt?.toISOString()).toBe("2027-04-21T08:00:00.000Z");
    expect(view.availability).toEqual([
      { startsOn: "2027-03-01", endsOn: "2027-03-31", kind: "available", note: null },
    ]);
    const row = (await audits()).find(
      (a) => a.action === "member.profile_updated" && a.entityId === ids.kitchen,
    );
    expect(row?.changes).toMatchObject({
      playaName: [null, "Sparkplug"],
      phone: ["[redacted]", "[redacted]"],
      diet: ["[redacted]", "[redacted]"],
      allergies: ["[redacted]", "[redacted]"],
    });
    expect(JSON.stringify(row?.changes)).not.toMatch(/shellfish|vegetarian|27820000009/);
  });

  it("F2 (deny): status and payment can't be set through the profile", async () => {
    const ctx = await as(ids.kitchen);
    await expect(
      updateProfile(ctx, ids.kitchen, { status: "confirmed" } as never),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateProfile(ctx, ids.kitchen, { paymentStatus: "paid_in_full" } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("F3: departure before arrival and unknown skills are refused", async () => {
    const ctx = await as(ids.kitchen);
    await expect(
      updateProfile(ctx, ids.kitchen, {
        arrivalAt: "2027-04-21T08:00:00Z",
        departureAt: "2027-04-20T08:00:00Z",
      }),
    ).rejects.toThrow(/Departure/);
    await expect(updateProfile(ctx, ids.kitchen, { skills: ["juggling"] })).rejects.toThrow(
      /juggling/,
    );
  });

  it("P6 (deny): a member can't edit others, change status or write notes", async () => {
    const ctx = await as(ids.kitchen);
    await expect(updateProfile(ctx, ids.gift, { playaName: "x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(setMemberStatus(ctx, ids.wait, "confirmed")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(addAdminNote(ctx, ids.gift, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addAdminNote(await as(ids.lead), ids.gift, "x")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("M1: confirming stops at capacity; raising the capacity lets it through", async () => {
    // 7 confirmed so far (everyone but "wait").
    await getDb().update(editions).set({ memberCapacity: 7 }).where(eq(editions.id, EDITION.id));
    const ctx = await as(ids.camp);
    await expect(setMemberStatus(ctx, ids.wait, "confirmed")).rejects.toThrow(
      /capacity reached \(7\)/,
    );
    await getDb().update(editions).set({ memberCapacity: 8 }).where(eq(editions.id, EDITION.id));
    await setMemberStatus(ctx, ids.wait, "confirmed");
    expect((await getPersonView(ctx, ids.wait)).status).toBe("confirmed");
    const row = (await audits()).find((a) => a.action === "member.status_changed");
    expect(row).toMatchObject({
      entityId: ids.wait,
      changes: { status: ["waitlisted", "confirmed"] },
      significance: "significant",
    });
  });

  it("M1: setting a status creates this year's record when there is none", async () => {
    const alum = await createPerson({ email: "alum@example.test", name: "Alum", status: null });
    await setMemberStatus(await as(ids.admin), alum, "waitlisted");
    expect((await getPersonView(await as(ids.admin), alum)).status).toBe("waitlisted");
  });

  it("M3: an admin adds a note that only admins read back", async () => {
    await addAdminNote(await as(ids.admin), ids.gift, "Owes a tent peg");
    expect(
      (await getPersonView(await as(ids.admin), ids.gift)).adminNotes?.map((n) => n.body),
    ).toEqual(["Owes a tent peg"]);
    expect((await getPersonView(await as(ids.camp), ids.gift)).adminNotes).toBeNull();
    await expect(addAdminNote(await as(ids.admin), ids.gift, "  ")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("refuses to change the status of a person who doesn't exist", async () => {
    const ghost = "01900000-0000-7000-8000-0000000fffff";
    await expect(setMemberStatus(await as(ids.admin), ghost, "confirmed")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
