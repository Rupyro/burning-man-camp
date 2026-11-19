// Tickets and passes: a member saves their own status; the camp board counts it (plan Phase 3).
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
import { saveMyTickets, setAllocations } from "../server/actions";
import { myTickets } from "../server/queries";
import { HomePage } from "../ui/pages/home";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});

describe("tickets", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
  });

  it("a member saves their own status, twice, and sees whether they're Gate-ready", async () => {
    await actAs(member);
    await ok(saveMyTickets({ ticket: "looking", vehiclePass: "need", earlyArrival: "no" }));
    await ok(saveMyTickets({ ticket: "have", vehiclePass: "need", earlyArrival: "no" }));
    expect(await myTickets(getDb(), EDITION.id, member)).toMatchObject({
      ticket: "have",
      vehiclePass: "need",
    });
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Not Gate-ready yet: still need a vehicle pass.");
    expect(html).not.toContain("Camp board");
  });

  it("only managers set allocations; the board counts against them", async () => {
    await actAs(member);
    await ok(
      saveMyTickets({ ticket: "stewards_offered", vehiclePass: "not_needed", earlyArrival: "no" }),
    );
    await expect(
      ok(setAllocations({ stewards: 3, vehiclePasses: 1, earlyPasses: 2 })),
    ).rejects.toThrow();
    await actAs(admin);
    await ok(setAllocations({ stewards: 3, vehiclePasses: 1, earlyPasses: 2 }));
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(html).toContain("Camp board");
    expect(html).toContain("Member M");
    expect(html).toMatch(/Stewards tickets left to offer: <b>2<\/b> of 3/);
  });
});
