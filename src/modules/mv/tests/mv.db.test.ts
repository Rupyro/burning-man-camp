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
  truncateAll,
} from "@/base/api/testing-db";

// The buttons use the app router; static rendering needs a stand-in.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { offerToDrive, setCleared } from "../server/actions";
import { listDrivers } from "../server/queries";
import { HomePage } from "../ui/pages/home";

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
});
