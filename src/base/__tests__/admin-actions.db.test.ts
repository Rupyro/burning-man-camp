// Admin screens' server actions: status, notes, roles, teams, edition settings.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, EDITION, getDb } from "@/base/api/testing-db";
import { ForbiddenError } from "@/base/errors";
import {
  addNote,
  changeMemberStatus,
  changeRole,
  changeTeamMember,
  saveAnchorDate,
  saveEdition,
} from "@/base/people/server/actions";
import { editions, teams } from "@/base/schema";
import { firstRow } from "@/lib/rows";
import { type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;

describe("admin server actions", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("(deny) members can't change status, notes, roles, teams, settings", async () => {
    await actAs(ids.kitchen);
    await expect(
      ok(changeMemberStatus({ personId: ids.gift, status: "removed" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(ok(addNote({ personId: ids.gift, body: "x" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      ok(changeRole({ personId: ids.kitchen, roleKey: "admin", grant: true })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(ok(saveEdition({ memberCapacity: 999 }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admins change status, notes, roles, teams and edition settings", async () => {
    await actAs(ids.admin);
    expect(await ok(changeMemberStatus({ personId: ids.wait, status: "confirmed" }))).toMatchObject(
      {
        ok: true,
      },
    );
    expect((await ok(addNote({ personId: ids.gift, body: "Owes a peg" }))).ok).toBe(true);
    expect(
      (await ok(changeRole({ personId: ids.gift, roleKey: "lnt_lead", grant: true }))).ok,
    ).toBe(
      false, // not a seeded role in this fixture: a readable error, not a crash
    );
    expect(
      (
        await ok(
          changeRole({ personId: ids.gift, roleKey: "kitchen_sensitive_viewer", grant: true }),
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await ok(
          changeRole({ personId: ids.gift, roleKey: "kitchen_sensitive_viewer", grant: false }),
        )
      ).ok,
    ).toBe(true);
    const kitchen = firstRow(
      await getDb()
        .select()
        .from(teams)
        .where(and(eq(teams.key, "kitchen"), eq(teams.editionId, EDITION.id))),
    );
    expect(
      (await ok(changeTeamMember({ teamId: kitchen.id, personId: ids.gift, role: "member" }))).ok,
    ).toBe(true);
    expect(
      (await ok(changeTeamMember({ teamId: kitchen.id, personId: ids.gift, role: null }))).ok,
    ).toBe(true);
    expect((await ok(saveEdition({ memberCapacity: 71 }))).ok).toBe(true);
    const ed = firstRow(await getDb().select().from(editions).where(eq(editions.id, EDITION.id)));
    expect(ed.memberCapacity).toBe(71);
    expect(
      (
        await ok(
          saveAnchorDate({
            key: "build_start",
            label: "Build",
            startsAt: "2027-04-21T06:00:00Z",
            isConfirmed: false,
          }),
        )
      ).ok,
    ).toBe(true);
  });
});
