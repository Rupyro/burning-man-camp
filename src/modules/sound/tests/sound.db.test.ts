// Sound plan and neighbor log: members log visits; only managers change the plan (plan Phase 6).
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
import { logVisit, savePlan } from "../server/actions";
import { getPlan } from "../server/queries";
import { HomePage } from "../ui/pages/home";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date("2027-09-01T19:00:00Z"),
  db: getDb(),
});
const plan = {
  quietFrom: "02:00",
  quietUntil: "09:00",
  maxDb: 95,
  speakersFace: "Open playa",
  notes: null,
};

describe("sound", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
  });

  it("only managers change the plan; it shows to everyone", async () => {
    await actAs(member);
    await expect(ok(savePlan(plan))).rejects.toThrow();
    await actAs(admin);
    await ok(savePlan(plan));
    expect(await getPlan(getDb(), EDITION.id)).toMatchObject({ maxDb: 95, quietFrom: "02:00" });
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Keep it under 95 dB");
    expect(html).toContain("Speakers face: Open playa");
  });

  it("a member logs a neighbor's visit, and it shows with who logged it", async () => {
    await actAs(member);
    await ok(
      logVisit({
        date: "2027-08-31",
        time: "02:40",
        neighbor: "Next-door camp",
        what: "Too much bass",
        action: "Turned it down",
      }),
    );
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(html).toContain("Neighbor log (1)");
    expect(html).toContain("Next-door camp");
    expect(html).toContain("We: Turned it down");
    expect(html).toContain("Logged by Member M");
  });
});
