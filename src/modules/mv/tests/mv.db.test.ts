// Art car drivers: members offer; only the DMV contact, camp lead or admin clears them.
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
  setFlagAs,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";

// The buttons use the app router; static rendering needs a stand-in.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { seed } from "../seed";
import { offerToDrive, setCleared } from "../server/actions";
import { listDrivers } from "../server/queries";
import { HomePage } from "../ui/pages/home";
import Router from "../ui/router";

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});

describe("mv drivers", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
    await setFlagAs(admin, "mv", { enabled: true });
  });

  it("a member offers once; only a manager clears; withdrawing removes the offer", async () => {
    await actAs(member);
    await ok(offerToDrive({ offer: true }));
    await ok(offerToDrive({ offer: true }));
    const [row] = await listDrivers(getDb(), EDITION.id);
    expect(row?.cleared).toBe(false);
    await expect(ok(setCleared({ id: row?.id ?? "", cleared: true, note: "" }))).rejects.toThrow();
    await actAs(admin);
    await ok(setCleared({ id: row?.id ?? "", cleared: true, note: "Briefed" }));
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("1 cleared of 1 offered");
    expect(html).toContain("Withdraw my offer");
    expect(html).not.toContain("Take back clearance");
    await actAs(member);
    await ok(offerToDrive({ offer: false }));
    expect(await listDrivers(getDb(), EDITION.id)).toHaveLength(0);
  });

  it("shows an empty roster, and managers get the clear buttons", async () => {
    const empty = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(empty).toContain("Nobody has offered yet.");
    expect(empty).toContain("I can drive the art car");
    await actAs(member);
    await ok(offerToDrive({ offer: true }));
    const forAdmin = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(forAdmin).toContain("not cleared yet");
    expect(forAdmin).toContain("Clear to drive");
  });

  it("the demo seed adds a cleared lead and an offering member, once", async () => {
    const lead = await createPerson({ email: "l@example.test", name: "Lead L" });
    const ctx = {
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    const rows = await listDrivers(getDb(), EDITION.id);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.cleared)).toHaveLength(1);
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(html).toContain("Briefed (demo)");
    expect(html).toContain("Take back clearance");
  });

  it("the router shows the home page and 404s anything below it", async () => {
    await actAs(member);
    const route = (slug: string[]) =>
      Router({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
    expect(renderToStaticMarkup(await route([]))).toContain("Art car drivers");
    await expect(route(["nope"])).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
