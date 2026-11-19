// Participation balance: every confirmed member, behind first, from planned shifts and credit.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { shiftsDutyTypes, shiftsSettings, shiftsSignups, shiftsSlots } from "../schema";
import { campBalance } from "../server/queries";
import { BalancePage } from "../ui/pages/balance";

const at = (h: number) => new Date(Date.UTC(2027, 8, 1, h));
let a: string;

describe("participation balance", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    a = await createPerson({ email: "a@example.test", name: "Ann" });
    await createPerson({ email: "b@example.test", name: "Ben" });
  });

  it("is null before shifts are set up", async () => {
    expect(await campBalance(getDb(), EDITION.id)).toBeNull();
  });

  it("lists everyone, with who has planned enough", async () => {
    await getDb()
      .insert(shiftsSettings)
      .values({ editionId: EDITION.id, freezeAt: at(0), minDutyHours: 4, minBuildStrikeDays: 0 });
    const [d] = await getDb()
      .insert(shiftsDutyTypes)
      .values({
        editionId: EDITION.id,
        key: "k",
        name: "Kitchen",
        category: "kitchen",
        maxStaff: 2,
      })
      .returning();
    const [s] = await getDb()
      .insert(shiftsSlots)
      .values({ editionId: EDITION.id, dutyTypeId: d?.id ?? "", startsAt: at(10), endsAt: at(15) })
      .returning();
    await getDb()
      .insert(shiftsSignups)
      .values({ slotId: s?.id ?? "", personId: a, status: "confirmed" });
    const rows = (await campBalance(getDb(), EDITION.id)) ?? [];
    expect(rows.map((r) => [r.name, r.enough])).toEqual([
      ["Ann", true],
      ["Ben", false],
    ]);
    const html = renderToStaticMarkup(
      await BalancePage({
        ctx: { actor: await actorFor(a), db: getDb(), edition: EDITION, now: new Date() },
      }),
    );
    expect(html).toContain("1 of 2 confirmed members");
    expect(html.indexOf("Ben")).toBeLessThan(html.indexOf("Ann"));
  });
});
