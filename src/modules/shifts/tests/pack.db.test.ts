// Burn pack reads: the recorded HELP-sheet lines (wall of valor) and who leads each duty.
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import { shiftsDutyTypes, shiftsSignups, shiftsSlots } from "../schema";
import { dutyLeads, helpWall } from "../server/queries";

const t = (h: number) => new Date(Date.UTC(2027, 3, 26, h));

describe("burn pack queries", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("lists only help-sheet cover as the wall, and duty leads by name", async () => {
    const lead = await createPerson({ email: "l@example.test", name: "Lee" });
    const kai = await createPerson({ email: "k@example.test", name: "Kai" });
    const jo = await createPerson({ email: "j@example.test", name: "Jo" });
    const [d] = await getDb()
      .insert(shiftsDutyTypes)
      .values({
        editionId: EDITION.id,
        key: "k",
        name: "Dinner",
        category: "kitchen",
        leadPersonId: lead,
      })
      .returning();
    await getDb()
      .insert(shiftsDutyTypes)
      .values({ editionId: EDITION.id, key: "m", name: "MOOP", category: "moop" });
    const [s] = await getDb()
      .insert(shiftsSlots)
      .values({
        editionId: EDITION.id,
        dutyTypeId: d?.id ?? "",
        startsAt: t(16),
        endsAt: t(19),
        maxStaff: 4,
      })
      .returning();
    await getDb()
      .insert(shiftsSignups)
      .values([
        { slotId: s?.id ?? "", personId: jo },
        { slotId: s?.id ?? "", personId: kai, source: "help_sheet" },
      ]);
    expect(await helpWall(getDb(), EDITION.id)).toMatchObject([
      { dutyName: "Dinner", takenBy: "Kai" },
    ]);
    expect(await dutyLeads(getDb(), EDITION.id)).toEqual([{ duty: "Dinner", lead: "Lee" }]);
  });
});
