// The load page and the CSV exports (spec §5, L2, L5, L7).
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/base/api";
import { editionMembers } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { logisticsLoads } from "../schema";
import { exportCsv } from "../server/exports";
import { listLoads } from "../server/queries";
import { HomePage } from "../ui/pages/home";
import { LoadPage } from "../ui/pages/load";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const ctxFor = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const loadId = async (name: string) =>
  (await listLoads(getDb(), EDITION.id)).find((l) => l.name === name)?.id ?? "";

describe("load page", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("the Logistics team packs, edits and moves a load; critical items first", async () => {
    const out = renderToStaticMarkup(
      await LoadPage({ ctx: await ctxFor(p.logi), id: await loadId("Container A to site") }),
    );
    expect(out).toContain("On this load (2/4 packed)");
    expect(out.indexOf("Generator 5 kVA")).toBeLessThan(out.indexOf("Scaffold poles"));
    expect(out).toContain("It&#x27;s left");
    expect(out).toContain("Cancel this load");
    expect(out).toContain("Where, when and how");
    expect(out).toContain("Add something");
    expect(out).not.toContain("Confirm it arrived");
  });

  it("another team lead can only confirm delivery, once it's on the road", async () => {
    const id = await loadId("Container A to site");
    const before = renderToStaticMarkup(await LoadPage({ ctx: await ctxFor(p.kitchenLead), id }));
    expect(before).toContain("Once it&#x27;s on the road");
    expect(before).not.toContain("Start packing");
    await getDb()
      .update(logisticsLoads)
      .set({ status: "in_transit" })
      .where(eq(logisticsLoads.id, id));
    const after = renderToStaticMarkup(await LoadPage({ ctx: await ctxFor(p.kitchenLead), id }));
    expect(after).toContain("Confirm it arrived on site");
  });

  it("a delivered load shows who confirmed it; members can't open loads", async () => {
    const out = renderToStaticMarkup(
      await LoadPage({ ctx: await ctxFor(p.logi), id: await loadId("Early build kit") }),
    );
    expect(out).toContain("Arrived: confirmed by Remo");
    expect(out).not.toContain("Add something");
    await expect(
      LoadPage({ ctx: await ctxFor(p.member), id: await loadId("Early build kit") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      LoadPage({ ctx: await ctxFor(p.logi), id: "01900000-0000-7000-8000-00000000dead" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("exports", () => {
  beforeEach(async () => {
    p = await seededCamp();
    await getDb()
      .update(editionMembers)
      .set({ buildCommitment: "full", arrivalAt: new Date("2027-04-12T08:00:00Z") })
      .where(eq(editionMembers.personId, p.fake[0] ?? ""));
    await getDb()
      .update(editionMembers)
      .set({ buildCommitment: "partial", arrivalAt: new Date("2027-04-14T21:30:00Z") })
      .where(eq(editionMembers.personId, p.fake[1] ?? ""));
  });

  it("WAP list: confirmed builders, name and email only; arrivals by camp day; both logged", async () => {
    await actAs(p.admin);
    const wap = await ok(exportCsv({ kind: "wap" }));
    expect(wap.filename).toBe(`wap-builders-${EDITION.year}.csv`);
    expect(wap.csv).toBe(
      "name,email\nFake 00,fake.p00@example.test\nFake 01,fake.p01@example.test",
    );
    const arr = await ok(exportCsv({ kind: "arrivals" }));
    // 21:30 UTC on the 14th is the 14th in camp time (SAST, UTC+2 → 23:30).
    expect(arr.csv.split("\n").slice(0, 3)).toEqual([
      "day,name,builder",
      "2027-04-12,Fake 00,yes",
      "2027-04-14,Fake 01,yes",
    ]);
    const logged = await getDb()
      .select()
      .from(baseTables.auditEvents)
      .where(eq(baseTables.auditEvents.action, "logistics.export.wap"));
    expect(logged).toHaveLength(1);
  });

  it("only Logistics leads, camp leads and admins export (L7)", async () => {
    for (const who of [p.member, p.logi, p.kitchenLead]) {
      await actAs(who);
      await expect(ok(exportCsv({ kind: "wap" }))).rejects.toThrow(ForbiddenError);
    }
    await actAs(p.camp);
    expect((await ok(exportCsv({ kind: "arrivals" }))).ok).toBe(true);
    const home = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(p.camp) }));
    expect(home).toContain("Arrivals by day");
    expect(home).toContain("Builders&#x27; WAP list (CSV)");
    const logi = renderToStaticMarkup(await HomePage({ ctx: await ctxFor(p.logi) }));
    expect(logi).not.toContain("Arrivals by day");
  });
});
