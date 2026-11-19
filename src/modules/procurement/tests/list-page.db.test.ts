// A team's printable shopping list (docs/specs/procurement.md §3, §5).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { ListPage } from "../ui/pages/list";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const page = async (who: string, teamId: string) =>
  renderToStaticMarkup(
    await ListPage({
      ctx: {
        actor: await actorFor(who),
        edition: EDITION,
        now: new Date("2027-03-01T18:00:00Z"),
        db: getDb(),
      },
      teamId,
    }),
  );

describe("shopping list", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("lists what's still to buy, grouped by type, with the gap and supplier; prints on A4", async () => {
    const out = await page(p.kitchenLead, p.kitchen);
    expect(out).toContain("Shopping list: Kitchen, 2027");
    expect(out).toContain("Generated Mar 1, 2027, 10:00 AM camp time (PT)");
    expect(out).toContain("Kitchen gear");
    expect(out).toContain("Cooler box (100 L)");
    expect(out).toContain("2 pcs"); // need 6, own 4 good
    expect(out).toContain("Fake Hardware Co (demo)");
    expect(out).toContain("Rice (10 kg bag)"); // ordered
    expect(out).not.toContain("Chafing dish"); // to borrow, not to buy
    expect(out).not.toContain("Gas burner"); // we have it
    expect(out).toContain("size: A4");
  });

  it("team members, camp leads and admins only; unknown teams 404", async () => {
    expect(await page(p.member, p.kitchen)).toContain("Shopping list");
    expect(await page(p.camp, p.gifts)).toContain("Cordless drill");
    await expect(page(p.member, p.gifts)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(page(p.outsider, p.kitchen)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(page(p.camp, "01900000-0000-7000-8000-00000000dead")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(page(p.camp, "x")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await page(p.camp, p.infra)).toContain("Nothing to buy right now.");
  });
});
