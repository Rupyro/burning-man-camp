// Item, need and "raise a need" screens: who gets which tools (docs/specs/procurement.md §5).
import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { procurementItems, procurementNeeds } from "../schema";
import { ItemPage } from "../ui/pages/item";
import { NeedPage } from "../ui/pages/need";
import { NewNeedPage } from "../ui/pages/new";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const ctx = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const itemId = async (name: string) =>
  (await getDb().select().from(procurementItems).where(eq(procurementItems.name, name)))[0]?.id ??
  "";
const needId = async (item: string) =>
  (
    await getDb()
      .select({ id: procurementNeeds.id })
      .from(procurementNeeds)
      .where(
        and(
          eq(procurementNeeds.itemId, await itemId(item)),
          eq(procurementNeeds.editionId, EDITION.id),
        ),
      )
  )[0]?.id ?? "";

describe("procurement pages", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("item page: stock by place and condition, a count form for members, recent changes", async () => {
    const out = renderToStaticMarkup(
      await ItemPage({ ctx: await ctx(p.member), id: await itemId("Staple gun") }),
    );
    expect(out).toContain("1 pcs good");
    expect(out).toContain("Container A");
    expect(out).toContain("Broken");
    expect(out).toContain("Update a count");
    expect(out).toContain("Scarce tool");
    expect(out).toContain("2026 strike count (demo)");
    expect(out).toContain("Teams that need it (1)");
    await expect(ItemPage({ ctx: await ctx(p.member), id: "nope" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      ItemPage({ ctx: await ctx(p.member), id: "01900000-0000-7000-8000-00000000dead" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("need page: the team lead gets the tools and can ask finance; a member of another team sees none", async () => {
    const id = await needId("Staple gun");
    const lead = renderToStaticMarkup(await NeedPage({ ctx: await ctx(p.lead), id }));
    expect(lead).toContain("We own 2 (1 broken or missing) in Container A. Buy 3.");
    expect(lead).toContain("Lead tools");
    expect(lead).toContain("Ask finance for the money to buy 3");
    expect(lead).toContain("Flag critical");
    expect(lead).toContain("Change the details");
    const other = renderToStaticMarkup(await NeedPage({ ctx: await ctx(p.kitchenLead), id }));
    expect(other).not.toContain("Lead tools");
    expect(other).not.toContain("Change the details");
    await expect(NeedPage({ ctx: await ctx(p.lead), id: "x" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("need page: asked finance shows it's waiting; closed needs have no tools", async () => {
    const asked = renderToStaticMarkup(
      await NeedPage({ ctx: await ctx(p.lead), id: await needId("Cordless drill") }),
    );
    expect(asked).toContain("Waiting on a spend request in Money.");
    expect(asked).not.toContain("Ask finance for the money");
    const done = renderToStaticMarkup(
      await NeedPage({ ctx: await ctx(p.camp), id: await needId("Extension reel (25 m)") }),
    );
    expect(done).toContain("it was received");
    expect(done).not.toContain("Lead tools");
  });

  it("raise a need: team picker for members, a nudge for people on no team", async () => {
    const out = renderToStaticMarkup(await NewNeedPage({ ctx: await ctx(p.member) }));
    expect(out).toContain("For which team?");
    expect(out).toContain("Kitchen");
    expect(out).toContain("Staple gun (pcs)");
    const none = renderToStaticMarkup(await NewNeedPage({ ctx: await ctx(p.outsider) }));
    expect(none).toContain("You need to be on a team");
  });
});
