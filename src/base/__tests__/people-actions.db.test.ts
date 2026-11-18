// The base screens' server actions: who the caller is comes from the session, never the input.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, getDb } from "@/base/api/testing-db";
import { UnauthenticatedError } from "@/base/errors";
import { saveMyProfile } from "@/base/people/server/actions";
import { people } from "@/base/schema";
import { type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;

describe("people server actions", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("saveMyProfile edits the caller's own record and reports validation errors", async () => {
    await actAs(ids.kitchen);
    expect(await ok(saveMyProfile({ patch: { playaName: "Spatula" } }))).toMatchObject({
      ok: true,
    });
    const [me] = await getDb().select().from(people).where(eq(people.id, ids.kitchen));
    expect(me?.playaName).toBe("Spatula");
    const bad = await ok(saveMyProfile({ patch: { paymentStatus: "paid_in_full" } }));
    expect(bad.ok).toBe(false);
    expect(bad.ok ? "" : bad.error).toMatch(/Invalid profile/);
  });

  it("(deny) signed-out callers are refused; the input can't pick whose profile", async () => {
    await actAs(null);
    await expect(ok(saveMyProfile({ patch: {} }))).rejects.toBeInstanceOf(UnauthenticatedError);
    await actAs(ids.kitchen);
    const r = await ok(saveMyProfile({ patch: { personId: ids.gift, playaName: "Hijack" } }));
    expect(r.ok).toBe(false);
    const [gift] = await getDb().select().from(people).where(eq(people.id, ids.gift));
    expect(gift?.playaName).toBeNull();
  });
});
