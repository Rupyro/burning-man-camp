// The Money home screen: what members vs leads vs finance get (docs/specs/finance.md §5).
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

describe("finance home page", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("a member sees only their own requests: no team budgets, totals, names of others or lead tools", async () => {
    const out = await html(p.member);
    expect(out).toContain("Request money");
    expect(out).toContain('aria-label="How asking for money works"');
    expect(out).toContain("Gas bottles (4 × 9 kg)");
    expect(out).toContain("Waiting for a finance approver");
    expect(out).not.toContain("Camp budget by team");
    expect(out).not.toContain(" approved of R");
    expect(out).not.toContain("Remo");
    expect(out).not.toContain('aria-label="Camp totals"');
    expect(out).not.toContain("<table");
    expect(out).not.toContain("Download CSV");
  });

  it("the finance approver gets the inbox, all requests, totals, budget form and CSV", async () => {
    const out = await html(p.finance);
    expect(out).toContain("Waiting for you (");
    expect(out).toContain('aria-label="Camp totals"');
    expect(out).toContain("All requests (");
    expect(out).toContain("Camp budget by team");
    expect(out).toContain("<table");
    expect(out).toContain("Set budget");
    expect(out).toContain("Download CSV");
  });

  it("a team lead sees their team's requests but no money tools", async () => {
    const out = await html(p.lead);
    expect(out).toContain("Your teams’ requests (");
    expect(out).toContain("Camp budget by team");
    expect(out).not.toContain("LED strips"); // Gift projects, not theirs
    expect(out).not.toContain("Download CSV");
  });

  it("someone on no team can't ask, and sees no requests", async () => {
    const out = await html(p.outsider);
    expect(out).not.toContain("Request money");
    expect(out).not.toContain('aria-label="How asking for money works"');
    expect(out).toContain("Your requests (0)");
  });
});
