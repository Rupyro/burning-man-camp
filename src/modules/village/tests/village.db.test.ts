// Village shares: leads record what's lent and borrowed; members see what's still out.
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

// The forms use the app router; static rendering needs a stand-in.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { seed } from "../seed";
import { addShare, setReturned } from "../server/actions";
import { listShares } from "../server/queries";
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
const share = (item: string, direction: "lend" | "borrow") => ({
  partner: "Camp Next Door",
  direction,
  resource: "tools" as const,
  item,
  quantity: 1,
  notes: "",
});

describe("village", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
    // The Village pack isn't in this camp's config, so switch the module on for the test.
    await setFlagAs(admin, "village", { enabled: true });
  });

  it("only leads record shares; returned ones drop out of what's still out", async () => {
    await actAs(member);
    await expect(ok(addShare(share("Nope", "lend")))).rejects.toThrow();
    await actAs(admin);
    const drill = await ok(addShare(share("Drill", "lend")));
    await ok(addShare(share("Ladder", "borrow")));
    let html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("1 of theirs with us, 1 of ours with them");
    expect(html).not.toContain("Record it");
    await ok(setReturned({ id: drill.id ?? "", returned: true }));
    html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(html).toContain("1 of theirs with us, 0 of ours with them");
    expect(html).toContain("Record it");
    expect((await listShares(getDb(), EDITION.id)).filter((r) => r.returned)).toHaveLength(1);
  });

  it("shows an empty list until something is shared", async () => {
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Nothing shared yet.");
    expect(html).not.toContain("Still out:");
  });

  it("the demo seed adds one borrowed and one returned loan, once", async () => {
    const lead = await createPerson({ email: "l@example.test", name: "Lead L" });
    const ctx = {
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    expect(await listShares(getDb(), EDITION.id)).toHaveLength(2);
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(admin) }));
    expect(html).toContain("Their generator, our extension run");
    expect(html).toContain("returned");
    expect(html).toContain("borrowed from");
  });

  it("the router shows the home page and 404s anything below it", async () => {
    await actAs(member);
    const route = (slug: string[]) =>
      Router({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
    expect(renderToStaticMarkup(await route([]))).toContain("Village");
    await expect(route(["nope"])).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
