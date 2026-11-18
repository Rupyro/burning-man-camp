// Dropping a shift offers it to the first person on standby; taking it tells the duty lead.
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import {
  actAs,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { shiftsDutyTypes, shiftsSettings, shiftsSlots, shiftsStandby } from "../schema";
import { claimShift } from "../server/actions";
import { dropShift, joinStandby, leaveStandby, takeStandby } from "../server/standby";
import job from "../server/standby-job";

const later = (days: number) => new Date(Date.now() + days * 86_400_000);
let lead: string;
let tom: string;
let naledi: string;
let sam: string;
let slotId: string;

const statusOf = async (personId: string) =>
  (await getDb().select().from(shiftsStandby).where(eq(shiftsStandby.personId, personId)))[0]
    ?.status;

describe("dropped shifts go to standby", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    lead = await createPerson({ email: "lead@example.test", name: "Lead" });
    tom = await createPerson({ email: "tom@example.test", name: "Tom" });
    naledi = await createPerson({ email: "naledi@example.test", name: "Naledi" });
    sam = await createPerson({ email: "sam@example.test", name: "Sam" });
    await getDb()
      .insert(shiftsSettings)
      .values({ editionId: EDITION.id, freezeAt: later(20) });
    const [d] = await getDb()
      .insert(shiftsDutyTypes)
      .values({
        editionId: EDITION.id,
        key: "prep",
        name: "Kitchen prep",
        category: "kitchen",
        maxStaff: 1,
        leadPersonId: lead,
      })
      .returning();
    const [s] = await getDb()
      .insert(shiftsSlots)
      .values({
        editionId: EDITION.id,
        dutyTypeId: d?.id ?? "",
        startsAt: later(30),
        endsAt: later(30.1),
      })
      .returning();
    slotId = s?.id ?? "";
    await actAs(tom);
    await ok(claimShift({ slotId }));
  });

  it("offers the place to the first person waiting, who can take it", async () => {
    await actAs(naledi);
    await ok(joinStandby({ slotId }));
    await actAs(sam);
    await ok(joinStandby({ slotId }));
    await actAs(tom);
    await ok(dropShift({ slotId }));
    expect(await statusOf(naledi)).toBe("offered");
    expect(await statusOf(sam)).toBe("waiting");
    await actAs(sam);
    await expect(ok(takeStandby({ slotId }))).rejects.toBeInstanceOf(ValidationError);
    await actAs(naledi);
    await ok(takeStandby({ slotId }));
    expect(await statusOf(naledi)).toBe("took");
    const [slot] = await getDb().select().from(shiftsSlots).where(eq(shiftsSlots.id, slotId));
    expect(slot?.status).toBe("filled");
    const out = await job({ db: getDb(), edition: EDITION, now: new Date() } as never);
    expect(out.reminders?.map((r) => [r.rule, r.personId, r.title])).toEqual([
      [
        "shifts.standby_took",
        lead,
        expect.stringMatching(
          /^Naledi took Tom's Kitchen prep shift on .* You don't need to do anything$/,
        ),
      ],
    ]);
  });

  it("moves to the next person when the first says not this time", async () => {
    await actAs(naledi);
    await ok(joinStandby({ slotId }));
    await actAs(sam);
    await ok(joinStandby({ slotId }));
    await actAs(tom);
    await ok(dropShift({ slotId }));
    await actAs(naledi);
    await ok(leaveStandby({ slotId }));
    expect(await statusOf(naledi)).toBe("passed");
    expect(await statusOf(sam)).toBe("offered");
  });

  it("does not offer anything when the camp has turned the rule off", async () => {
    await getDb().execute(
      sql`insert into automation_settings (key, value) values ('shift_standby_offer', 0)`,
    );
    await actAs(naledi);
    await ok(joinStandby({ slotId }));
    await actAs(tom);
    await ok(dropShift({ slotId }));
    expect(await statusOf(naledi)).toBe("waiting");
  });

  it("refuses what doesn't make sense, and lets someone stop waiting", async () => {
    const bad = (p: Promise<unknown>) => expect(ok(p)).rejects.toBeInstanceOf(ValidationError);
    await actAs(tom);
    await bad(joinStandby({ slotId }));
    await actAs(naledi);
    await bad(dropShift({ slotId }));
    await bad(leaveStandby({ slotId }));
    await bad(takeStandby({ slotId }));
    await ok(joinStandby({ slotId }));
    await ok(leaveStandby({ slotId }));
    expect(await statusOf(naledi)).toBe("left");
    await actAs(tom);
    await ok(dropShift({ slotId }));
    await actAs(naledi);
    await bad(joinStandby({ slotId }));
    const out = await job({ db: getDb(), edition: EDITION, now: new Date() } as never);
    expect(out.reminders).toEqual([]);
  });

  it("tells the person a shift is open for them", async () => {
    await actAs(naledi);
    await ok(joinStandby({ slotId }));
    await actAs(tom);
    await ok(dropShift({ slotId }));
    const out = await job({ db: getDb(), edition: EDITION, now: new Date() } as never);
    expect(out.reminders?.map((r) => [r.rule, r.personId])).toEqual([
      ["shifts.standby_offer", naledi],
    ]);
  });
});
