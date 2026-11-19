// Camp schedule: managers add events in camp time; members see them; overlaps are flagged.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import {
  actAs,
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  setFlagAs,
  truncateAll,
} from "@/base/api/testing-db";
import { addEvent, removeEvent } from "../server/actions";
import { listEvents } from "../server/queries";
import { HomePage } from "../ui/pages/home";

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const ev = (title: string, start: string, end: string) => ({
  title,
  description: "",
  category: "class" as const,
  date: "2027-09-01",
  start,
  end,
  location: "",
  hostPersonId: null,
});

describe("schedule", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
    // The Workshops pack isn't in this camp's config, so switch the module on for the test.
    await setFlagAs(admin, "schedule", { enabled: true });
  });

  it("only managers add; a late event runs past midnight; overlaps show to managers", async () => {
    await actAs(member);
    await expect(ok(addEvent(ev("Nope", "10:00", "11:00")))).rejects.toThrow();
    await actAs(admin);
    await ok(addEvent(ev("Knots", "14:00", "15:00")));
    await ok(addEvent(ev("Tea", "14:30", "15:30")));
    await ok(addEvent(ev("Late set", "23:00", "02:00")));
    const rows = await listEvents(getDb(), EDITION.id);
    expect(rows.map((r) => r.title)).toEqual(["Knots", "Tea", "Late set"]);
    const late = rows[2];
    expect((late?.endsAt.getTime() ?? 0) - (late?.startsAt.getTime() ?? 0)).toBe(3 * 3_600_000);
    const lead = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(lead).toContain("Overlaps to fix");
    expect(lead).toContain("Knots and Tea");
    expect(lead).toContain("for the event guide (CSV)");
    const mine = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(mine).toContain("Knots");
    expect(mine).not.toContain("Overlaps to fix");
    await ok(removeEvent({ id: rows[1]?.id ?? "" }));
    expect(await listEvents(getDb(), EDITION.id)).toHaveLength(2);
  });
});
