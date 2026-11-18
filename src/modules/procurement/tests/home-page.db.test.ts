// The Kit and stock home screen: members vs leads vs the camp lead (docs/specs/procurement.md §5).

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { HomePage, sortNeeds } from "../ui/pages/home";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const html = async (who: string, q = "") =>
  renderToStaticMarkup(
    await HomePage({
      ctx: { actor: await actorFor(who), edition: EDITION, now: new Date(), db: getDb() },
      q,
    }),
  );

describe("procurement home page", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("a member sees search, their team's open needs and the kit, but no board or import", async () => {
    const out = await html(p.member);
    expect(out).toContain("Raise a need");
    expect(out).toContain("Your team’s needs (4)"); // Kitchen: gas burners, cooler boxes, chafing dishes, rice
    expect(out).toContain("Cooler box (100 L)");
    expect(out).not.toContain('Staple gun</a></div><p class="text-xs text-muted-foreground">Gift');
    expect(out).not.toContain("Needs: ");
    expect(out).not.toContain('data-testid="kit-totals"');
    expect(out).not.toContain('aria-label="Filter and sort needs"');
    expect(out).not.toContain("Import a tool list");
    expect(out).toContain("Scarce tools (6)");
    expect(out).toContain("Search above to find any of the 30 things we own.");
  });

  it("a team lead gets one needs table for their team, totals, shopping lists and CSV import", async () => {
    const out = await html(p.lead);
    expect(out).toContain("Needs: your teams");
    expect(out).toContain('data-testid="kit-totals"');
    expect(out).toContain('aria-label="Filter and sort needs"');
    expect(out.match(/<table/g)).toHaveLength(2); // needs + kit; the old board boxes are gone
    expect(out).toContain("Buy 3");
    expect(out).toContain("We own 2 (1 broken or missing) in Container A. Buy 3.");
    expect(out).toContain("/procurement/list/");
    expect(out).toContain("Import a tool list");
    expect(out).not.toContain('<td class="p-3">Kitchen</td>'); // Kitchen's needs aren't in their table
    expect(out).not.toContain("Your team’s needs"); // the board already covers their team
  });

  it("the camp lead sees every team's needs, critical first", async () => {
    const out = await html(p.camp);
    expect(out).toContain("Needs: every team");
    expect(out).toContain("Critical");
    expect(out).toContain("Generator 5 kVA");
    expect(out).toContain("received or cancelled (not shown)");
  });

  it("the camp lead can filter the needs table by team and status, and sort it", async () => {
    const all = await html(p.camp);
    const ctx = { actor: await actorFor(p.camp), edition: EDITION, now: new Date(), db: getDb() };
    const only = renderToStaticMarkup(
      await HomePage({ ctx, view: { team: p.kitchen, sort: "item" } }),
    );
    expect(only).toContain('<td class="p-3">Kitchen</td>');
    expect(only).not.toContain("× Generator 5 kVA"); // an infra need, filtered out
    expect(all).toContain("× Generator 5 kVA");
    const needed = renderToStaticMarkup(await HomePage({ ctx, view: { status: "ordered" } }));
    expect(needed).not.toContain("Buy 3");
  });

  it("sortNeeds orders by the chosen column, critical first on ties", () => {
    const n = (
      itemName: string,
      teamName: string,
      status: "needed" | "ordered",
      neededBy: string | null,
      isCritical = false,
    ) => ({ itemName, teamName, status, neededBy, isCritical });
    const rows = [
      n("b", "Zed", "ordered", "2027-01-01"),
      n("a", "Art", "needed", null),
      n("c", "Art", "needed", null, true),
    ];
    expect(sortNeeds(rows, "item").map((r) => r.itemName)).toEqual(["a", "b", "c"]);
    expect(sortNeeds(rows, "team").map((r) => r.itemName)).toEqual(["c", "a", "b"]);
    expect(sortNeeds(rows, "status").map((r) => r.itemName)).toEqual(["c", "a", "b"]);
    expect(sortNeeds(rows, "due").map((r) => r.itemName)).toEqual(["b", "c", "a"]);
    expect(sortNeeds(rows, "bogus").map((r) => r.itemName)).toEqual(["c", "a", "b"]);
  });

  it("search narrows the kit; someone on no team can't raise", async () => {
    const out = await html(p.outsider, "staple");
    expect(out).toContain("Kit matching “staple” (1)");
    expect(out).not.toContain("Raise a need");
    expect(await html(p.outsider, "zzz")).toContain("Nothing found");
    expect(await html(p.outsider)).toContain("not on a team yet");
  });
});
