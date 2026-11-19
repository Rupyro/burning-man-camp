// The Travel and loads home screen: members vs the Logistics team vs other leads (spec §5).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { HomePage } from "../ui/pages/home";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const html = async (who: string) =>
  renderToStaticMarkup(
    await HomePage({
      ctx: { actor: await actorFor(who), edition: EDITION, now: new Date(), db: getDb() },
    }),
  );

describe("logistics home page", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("a member sees their travel, rides that fit, and a request waiting; no loads or gaps", async () => {
    const out = await html(p.member);
    expect(out).toContain("Your travel");
    expect(out).toContain("Rides that fit: to the burn");
    expect(out).toContain("Ask for a seat");
    expect(out).toContain("wants a lift");
    expect(out).toContain("Yes, there&#x27;s space");
    expect(out).toContain("Phone numbers show once the driver says yes.");
    expect(out).not.toContain("+2782555");
    expect(out).not.toContain("Critical, not on its way");
    expect(out).not.toContain("Loads (");
  });

  it("the Logistics team sees totals, gaps they can put on a load, the loads and a new-load form", async () => {
    const out = await html(p.logi);
    expect(out).toContain('aria-label="Logistics totals"');
    expect(out).toContain("Critical, not on its way (3)");
    expect(out).toContain("Fire extinguisher 10 lb × 2");
    expect(out).toContain("Its load has no destination");
    expect(out).toContain("Put on load");
    expect(out).toContain("Loads (5)");
    expect(out).toContain("Container A to site");
    expect(out).toContain("Plan a new load");
  });

  it("another team lead sees loads and gaps read-only (they can confirm deliveries, not plan)", async () => {
    const out = await html(p.kitchenLead);
    expect(out).toContain("Critical, not on its way (3)");
    expect(out).not.toContain("Put on load");
    expect(out).not.toContain("Plan a new load");
  });

  it("an accepted rider sees the driver's phone; nobody else does", async () => {
    // Fake 03 rides with fake 00 (accepted in the seed); the base person has no phone, so use email.
    const out = await html(p.fake[3] ?? "");
    expect(out).toContain("Lift with Fake 00");
    expect(out).toContain("mailto:fake.p00@example.test");
    const other = await html(p.fake[5] ?? "");
    expect(other).not.toContain("mailto:fake.p00@example.test");
  });
});
