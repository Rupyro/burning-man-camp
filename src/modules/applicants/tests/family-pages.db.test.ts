// Oe-aa-sies Family screens rendered from the database: queue, detail, journey, home and welcome card.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { decideFamily, sendFamilyJourney } from "../server/family-actions";
import { familyYearsOf } from "../server/family-years";
import { myApplication } from "../server/queries";
import { FamilyDetailPage, FamilyJourneyPage, FamilyQueuePage } from "../ui/pages/family";
import { ApplicantHome } from "../ui/pages/home";
import { WelcomePage } from "../ui/pages/welcome";
import { applicantCamp } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

let p: Awaited<ReturnType<typeof applicantCamp>>;
const ctx = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const html = async (el: Promise<React.ReactNode>) => renderToStaticMarkup(await el);
const journey = {
  years: [2024, 2025, 2026],
  teams: ["Build"],
  led: true,
  ledWhat: "Co-led the Cloud",
  buildPieces: ["Cloud"],
  goodAt: ["Lights & wiring"],
  loveTo: ["Leading a team"],
  anythingElse: "Bring the big kettle",
};
async function sent() {
  await actAs(p.kai);
  await ok(sendFamilyJourney(journey));
  return (await myApplication(getDb(), EDITION.id, p.kai))?.id ?? "";
}

describe("family pages", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("queue is empty, then shows who is waiting with a gentle thought", async () => {
    expect(await html(FamilyQueuePage({ ctx: await ctx(p.admin) }))).toContain(
      "No one waiting right now.",
    );
    await sent();
    const out = await html(FamilyQueuePage({ ctx: await ctx(p.admin) }));
    expect(out).toContain("Waiting to be welcomed");
    expect(out).toContain("A thought:");
  });

  it("detail shows memories and the welcome buttons; bad ids are not found", async () => {
    const id = await sent();
    const out = await html(FamilyDetailPage({ ctx: await ctx(p.admin), id }));
    expect(out).toContain("Their memories");
    expect(out).toContain("Bring the big kettle");
    await expect(html(FamilyDetailPage({ ctx: await ctx(p.admin), id: "nope" }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      html(
        FamilyDetailPage({ ctx: await ctx(p.admin), id: "00000000-0000-0000-0000-000000000000" }),
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await html(FamilyDetailPage({ ctx: await ctx(p.lead), id }))).toContain(
      "Only camp admins",
    );
  });

  it("asked and declined show their state on the detail", async () => {
    const id = await sent();
    await actAs(p.admin);
    await ok(decideFamily({ id, decision: "asked", note: "Which year was the dust storm?" }));
    expect(await html(FamilyQueuePage({ ctx: await ctx(p.admin) }))).toContain(
      "You asked them a question.",
    );
    await ok(decideFamily({ id, decision: "declined" }));
    expect(await html(FamilyDetailPage({ ctx: await ctx(p.admin), id }))).toContain(
      "Declined kindly.",
    );
  });

  it("journey opens for a fresh applicant, and sends them home once sent", async () => {
    expect(await html(FamilyJourneyPage({ ctx: await ctx(p.kai) }))).toContain("journey");
    await sent();
    await expect(html(FamilyJourneyPage({ ctx: await ctx(p.kai) }))).rejects.toThrow(
      "NEXT_REDIRECT /apply",
    );
    const home = await html(ApplicantHome({ ctx: await ctx(p.kai), sent: true }));
    expect(home).toContain("2026");
  });

  it("welcomed family get their lantern card and years badges", async () => {
    const id = await sent();
    await actAs(p.admin);
    await ok(decideFamily({ id, decision: "approved" }));
    expect(await html(FamilyDetailPage({ ctx: await ctx(p.admin), id }))).toContain(
      "Their interview was skipped",
    );
    expect(await familyYearsOf(await ctx(p.kai))).toEqual([2024, 2025, 2026]);
    expect(await familyYearsOf(await ctx(p.admin))).toEqual([]);
    const out = await html(WelcomePage({ ctx: await ctx(p.kai) }));
    expect(out).toContain("3 years in bloom");
    await expect(html(FamilyJourneyPage({ ctx: await ctx(p.kai) }))).rejects.toThrow(
      "NEXT_REDIRECT /apply",
    );
  });
});

describe("You're in page", () => {
  it("opens for a confirmed member instead of a 404", async () => {
    const Router = (await import("../ui/router")).default;
    const confirmed = await applicantCamp().then((c) => c.member);
    await actAs(confirmed);
    const out = renderToStaticMarkup(
      await Router({
        params: Promise.resolve({ slug: ["welcome"] }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(out).toContain("re in, Sam!");
  });
});
