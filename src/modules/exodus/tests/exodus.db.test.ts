// Exodus: members set their own departure; managers see travel notes and the sweep-crew gap.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/base/api/testing";
import {
  actAs,
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";

// The departure form uses the app router; static rendering needs a stand-in.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { clearMyDeparture, setMyDeparture } from "../server/actions";
import { listDepartures } from "../server/queries";
import { HomePage } from "../ui/pages/home";

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});

describe("exodus", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
  });

  it("each member sets one departure; travel notes show to managers only", async () => {
    await actAs(member);
    const leave = { date: "2027-09-06", time: "06:00", staysForSweep: false, travel: "Own car" };
    await ok(setMyDeparture(leave));
    await ok(setMyDeparture({ ...leave, time: "07:30" }));
    await actAs(admin);
    await ok(setMyDeparture({ ...leave, date: "2027-09-07", staysForSweep: true, travel: "" }));
    const rows = await listDepartures(getDb(), EDITION.id);
    expect(rows.map((r) => r.name)).toEqual(["Member M", "Admin A"]);
    const lead = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(lead).toContain("Own car");
    expect(lead).toContain("1 staying");
    const mine = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(mine).toContain("Member M");
    expect(mine).not.toContain("Own car");
    await actAs(member);
    await ok(clearMyDeparture({}));
    expect(await listDepartures(getDb(), EDITION.id)).toHaveLength(1);
  });
});
