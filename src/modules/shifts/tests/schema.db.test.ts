// The database refuses bad staffing, overlapping live claims, half close-outs and self-credit.
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import {
  shiftsCoverRequests,
  shiftsDutyTypes,
  shiftsPrecredits,
  shiftsSettings,
  shiftsSignups,
  shiftsSlots,
} from "../schema";

let a: string;
let b: string;
const t = (h: number) => new Date(Date.UTC(2027, 3, 26, h));

async function duty(extra: Partial<typeof shiftsDutyTypes.$inferInsert> = {}) {
  const [d] = await getDb()
    .insert(shiftsDutyTypes)
    .values({ editionId: EDITION.id, key: "k", name: "K", category: "kitchen", ...extra })
    .returning();
  if (!d) throw new Error("no duty");
  return d;
}
async function slot(dutyTypeId: string) {
  const [s] = await getDb()
    .insert(shiftsSlots)
    .values({ editionId: EDITION.id, dutyTypeId, startsAt: t(7), endsAt: t(10) })
    .returning();
  if (!s) throw new Error("no slot");
  return s;
}

describe("shifts tables", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    a = await createPerson({ email: "a@example.test", name: "A" });
    b = await createPerson({ email: "b@example.test", name: "B" });
  });

  it("settings: typed defaults and ranges", async () => {
    const [s] = await getDb()
      .insert(shiftsSettings)
      .values({ editionId: EDITION.id, freezeAt: t(0) })
      .returning();
    expect(s).toMatchObject({ minDutyHours: 8, minBuildStrikeDays: 4, maxPrecreditPercent: 50 });
    await expect(
      getDb().update(shiftsSettings).set({ maxPrecreditPercent: 101 }),
    ).rejects.toThrow();
  });

  it("duty types: staffing makes sense, backup isn't the lead, keys unique", async () => {
    await expect(duty({ minStaff: 3, maxStaff: 2 })).rejects.toThrow();
    await expect(duty({ leadPersonId: a, backupPersonId: a })).rejects.toThrow();
    await duty();
    await expect(duty()).rejects.toThrow();
  });

  it("slots: end after start; close-out records who, when and unfilled places together", async () => {
    const d = await duty();
    await expect(
      getDb()
        .insert(shiftsSlots)
        .values({ editionId: EDITION.id, dutyTypeId: d.id, startsAt: t(10), endsAt: t(9) }),
    ).rejects.toThrow();
    const s = await slot(d.id);
    await expect(getDb().update(shiftsSlots).set({ status: "closed_out" })).rejects.toThrow();
    await getDb()
      .update(shiftsSlots)
      .set({
        status: "closed_out",
        closedOutAt: t(11),
        closedOutByPersonId: a,
        unfilledAtCloseOut: 0,
      });
    expect(s.status).toBe("open");
  });

  it("one live signup per person per shift; released history allowed", async () => {
    const s = await slot((await duty()).id);
    const [first] = await getDb()
      .insert(shiftsSignups)
      .values({ slotId: s.id, personId: a })
      .returning();
    await expect(
      getDb().insert(shiftsSignups).values({ slotId: s.id, personId: a }),
    ).rejects.toThrow();
    await getDb().update(shiftsSignups).set({ status: "released" });
    await getDb().insert(shiftsSignups).values({ slotId: s.id, personId: a });
    // A swap always names a member, and only that member can accept it.
    const req = { fromSignupId: first?.id ?? "", kind: "swap" as const, reason: "clash" as const };
    await expect(getDb().insert(shiftsCoverRequests).values(req)).rejects.toThrow();
    await getDb()
      .insert(shiftsCoverRequests)
      .values({ ...req, toPersonId: b });
    // One open cover request per signup.
    await expect(
      getDb()
        .insert(shiftsCoverRequests)
        .values({ ...req, toPersonId: b }),
    ).rejects.toThrow();
    await expect(getDb().update(shiftsCoverRequests).set({ status: "accepted" })).rejects.toThrow();
    await expect(
      getDb().update(shiftsCoverRequests).set({ status: "accepted", acceptedByPersonId: a }),
    ).rejects.toThrow();
    await getDb().update(shiftsCoverRequests).set({ status: "accepted", acceptedByPersonId: b });
  });

  it("done and no-show are only ever a lead's record, never automatic", async () => {
    const s = await slot((await duty()).id);
    await getDb().insert(shiftsSignups).values({ slotId: s.id, personId: a });
    await expect(getDb().update(shiftsSignups).set({ status: "completed" })).rejects.toThrow();
    await getDb()
      .update(shiftsSignups)
      .set({ status: "completed", markedByPersonId: b, markedAt: t(12) });
    // HELP-sheet cover: the taker gets their own signup when the lead records it.
    await getDb().insert(shiftsSignups).values({ slotId: s.id, personId: b, source: "help_sheet" });
  });

  it("pre-Burn credit: in range and never self-granted", async () => {
    const row = { editionId: EDITION.id, personId: a, kind: "design" as const, hours: 4 };
    await expect(
      getDb()
        .insert(shiftsPrecredits)
        .values({ ...row, grantedByPersonId: a }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(shiftsPrecredits)
        .values({ ...row, hours: 0, grantedByPersonId: b }),
    ).rejects.toThrow();
    await getDb()
      .insert(shiftsPrecredits)
      .values({ ...row, grantedByPersonId: b });
  });
});
