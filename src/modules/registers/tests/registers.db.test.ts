// Safety registers: leads add lines and count stakes pulled; members see them.
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
  truncateAll,
} from "@/base/api/testing-db";
import { addItem, removeItem, setPulled } from "../server/actions";
import { listItems } from "../server/queries";
import { HomePage } from "../ui/pages/home";

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const item = (kind: "fuel" | "flame" | "stake", label: string, quantity: number) => ({
  kind,
  label,
  quantity,
  location: "",
  notes: "",
  ownerPersonId: null,
});

describe("registers", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
  });

  it("only leads add; stakes are counted out; members see the lists", async () => {
    await actAs(member);
    await expect(ok(addItem(item("fuel", "Nope", 5)))).rejects.toThrow();
    await actAs(admin);
    await ok(addItem(item("fuel", "Cans", 40)));
    const stake = await ok(addItem(item("stake", "Rebar", 48)));
    const fuel = (await listItems(getDb(), EDITION.id)).find((r) => r.kind === "fuel");
    await expect(ok(setPulled({ id: stake.id ?? "", pulled: 49 }))).rejects.toThrow();
    await expect(ok(setPulled({ id: fuel?.id ?? "", pulled: 1 }))).rejects.toThrow();
    await ok(setPulled({ id: stake.id ?? "", pulled: 40 }));
    const html = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Cans");
    expect(html).toContain("8 still in the ground");
    await ok(removeItem({ id: stake.id ?? "" }));
    expect(await listItems(getDb(), EDITION.id)).toHaveLength(1);
  });
});
