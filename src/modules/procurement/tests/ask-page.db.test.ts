// "Ask the camp" page: what the lead sees after asking and fixing, and who sees the box.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { procurementItems } from "../schema";
import { askTheCamp, fixAsk } from "../server/ask";
import { myRecentAsks } from "../server/ask-queries";
import { AskPage } from "../ui/pages/ask";
import { procurementCamp } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

let p: Awaited<ReturnType<typeof procurementCamp>>;
const ctxOf = async (who: string) =>
  ({ actor: await actorFor(who), edition: EDITION, now: new Date(), db: getDb() }) as Parameters<
    typeof AskPage
  >[0]["ctx"];

describe("ask the camp page", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("shows what was done, the demo label, and the fixes", async () => {
    await getDb().insert(procurementItems).values({ name: "Ice", category: "other", unit: "kg" });
    await actAs(p.kitchenLead);
    await ok(askTheCamp({ text: "hmm something odd" }));
    const r = await ok(askTheCamp({ text: "need 20 kg of ice by Tuesday" }));
    let html = renderToStaticMarkup(await AskPage({ ctx: await ctxOf(p.kitchenLead) }));
    expect(html).toContain("Demo version");
    expect(html).toContain("Here&#x27;s what I did");
    expect(html).toContain("Added to the team&#x27;s buy list");
    expect(html).toContain("Not on the buy list");
    expect(html).toContain("a guess");
    expect(html).toContain("no date");
    expect(html).toContain("demo (keywords)");
    expect(html).toContain("Looks right");
    await ok(fixAsk({ askId: r.id, action: "change_date", dueOn: "2027-03-02" }));
    await ok(fixAsk({ askId: r.id, action: "looks_right" }));
    html = renderToStaticMarkup(await AskPage({ ctx: await ctxOf(p.kitchenLead) }));
    expect(html).toContain("You said this looks right.");
    expect(html).toContain("Your fix is saved");
    const asks = await myRecentAsks(await ctxOf(p.kitchenLead));
    expect(asks[0]).toMatchObject({ dueOn: "2027-03-02", confirmed: true, fixed: true });
    expect(asks[0]?.ownerName).toBe("Alex");
  });

  it("members get a pointer to their lead; a lead with no asks sees just the box", async () => {
    const member = renderToStaticMarkup(await AskPage({ ctx: await ctxOf(p.member) }));
    expect(member).toContain("Ask the camp is for team leads");
    expect(await myRecentAsks(await ctxOf(p.lead))).toEqual([]);
    const lead = renderToStaticMarkup(await AskPage({ ctx: await ctxOf(p.lead) }));
    expect(lead).toContain("What do you need?");
    expect(lead).not.toContain("Here&#x27;s what I did");
  });
});
