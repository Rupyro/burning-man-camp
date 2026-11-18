// Oe-aa-sies Family fast track through the guard: sending the journey, admin-only welcome,
// and welcoming in skips the interview.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, EDITION, getDb } from "@/base/api/testing-db";
import { applicantFamilyApprovals, applicantFamilyYears } from "../schema";
import { decideFamily, sendFamilyJourney } from "../server/family-actions";
import { familyByApplication, familyFor, familyWaiting } from "../server/family-queries";
import { myApplication } from "../server/queries";
import { applicantCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof applicantCamp>>;
const journey = {
  years: [2019, 2024, 2025, 2026],
  teams: ["Build"],
  led: true,
  ledWhat: "Co-led the Cloud",
  buildPieces: ["Cloud"],
  goodAt: ["Lights & wiring"],
  loveTo: ["Leading a team"],
  anythingElse: "",
};
async function sent() {
  await actAs(p.kai);
  expect(await ok(sendFamilyJourney(journey))).toEqual({ ok: true });
  return (await myApplication(getDb(), EDITION.id, p.kai))?.id ?? "";
}

describe("Oe-aa-sies Family", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("sends years (2023 onward only) and memories, and waits to be welcomed", async () => {
    const id = await sent();
    const app = await myApplication(getDb(), EDITION.id, p.kai);
    expect(app?.status).toBe("applied");
    const ys = await getDb()
      .select()
      .from(applicantFamilyYears)
      .where(eq(applicantFamilyYears.applicationId, id));
    expect(ys.map((y) => y.year).sort()).toEqual([2024, 2025, 2026]);
    const waiting = await familyWaiting(getDb(), EDITION.id);
    expect(waiting[0]).toMatchObject({ years: [2024, 2025, 2026], suggestion: "could lead Build" });
  });

  it("needs at least one real year", async () => {
    await actAs(p.kai);
    const r = await ok(sendFamilyJourney({ ...journey, years: [2019] }));
    expect(r.ok).toBe(false);
  });

  it("only admins can welcome family in", async () => {
    const id = await sent();
    await actAs(p.lead);
    const r = await ok(decideFamily({ id, decision: "approved" }));
    expect(r.ok).toBe(false);
    expect((await myApplication(getDb(), EDITION.id, p.kai))?.status).toBe("applied");
  });

  it("welcoming in skips the interview and confirms their years", async () => {
    const id = await sent();
    await actAs(p.admin);
    expect((await ok(decideFamily({ id, decision: "approved" }))).ok).toBe(true);
    const app = await myApplication(getDb(), EDITION.id, p.kai);
    expect(app?.status).toBe("accepted");
    expect(app?.interviewAt).toBeNull();
    expect(app?.interviewDoneAt).toBeInstanceOf(Date);
    expect((await familyFor(getDb(), p.kai)).confirmed).toEqual([2024, 2025, 2026]);
    const [ap] = await getDb()
      .select()
      .from(applicantFamilyApprovals)
      .where(eq(applicantFamilyApprovals.applicationId, id));
    expect(ap?.decision).toBe("approved");
    expect((await ok(decideFamily({ id, decision: "declined" }))).ok).toBe(false);
  });

  it("asking a question keeps them waiting; declining closes it kindly", async () => {
    const id = await sent();
    await actAs(p.admin);
    await ok(decideFamily({ id, decision: "asked", note: "Which build crew?" }));
    expect((await familyWaiting(getDb(), EDITION.id))[0]?.decision).toBe("asked");
    await ok(decideFamily({ id, decision: "declined" }));
    expect((await myApplication(getDb(), EDITION.id, p.kai))?.status).toBe("declined");
    expect(await familyWaiting(getDb(), EDITION.id)).toEqual([]);
  });

  it("has nothing to show before anyone sends a journey", async () => {
    expect(await familyWaiting(getDb(), EDITION.id)).toEqual([]);
    expect(await familyByApplication(getDb(), "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect((await familyFor(getDb(), p.kai)).confirmed).toEqual([]);
  });

  it("suggests gently when they did not lead, and a decision is made only once", async () => {
    await actAs(p.kai);
    await ok(sendFamilyJourney({ ...journey, led: false, ledWhat: "", teams: [], loveTo: [] }));
    const id = (await myApplication(getDb(), EDITION.id, p.kai))?.id ?? "";
    expect((await familyByApplication(getDb(), id))?.suggestion).toMatch(/happy anywhere/);
    await actAs(p.admin);
    expect((await ok(decideFamily({ id, decision: "declined" }))).ok).toBe(true);
    expect(await decideFamily({ id, decision: "approved" })).not.toEqual({ ok: true });
    await actAs(p.kai);
    expect(await sendFamilyJourney(journey)).not.toEqual({ ok: true });
  });
});
