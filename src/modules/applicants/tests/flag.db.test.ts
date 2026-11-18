// Switching the Applications module off (MODULE_RULEBOOK flag-off rule): routes 404 for everyone,
// the tile goes, actions are refused, and a payment delivered while it's off is skipped. Data stays.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/base/api";
import { ok } from "@/base/api/testing";
import {
  actAs,
  dispatchPending,
  EDITION,
  getDb,
  landingFor,
  layoutStatus,
  seedEventsFor,
  setFlagAs,
} from "@/base/api/testing-db";
import { REQUIRED_DOCS } from "../rules/journey";
import { applicantDocuments, applicantApplications as apps } from "../schema";
import { saveApplication, updateApplication } from "../server/actions";
import { applicantCamp, GOOD_ANSWERS } from "./fixtures";

let p: Awaited<ReturnType<typeof applicantCamp>>;

describe("applications switched off", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("404s, no tile, actions refused, a late payment skipped; switching back on restores it", async () => {
    await actAs(p.kai);
    await ok(saveApplication({ answers: GOOD_ANSWERS, submit: true }));
    const [app] = await getDb()
      .update(apps)
      .set({ status: "accepted", interviewDoneAt: new Date(), decidedAt: new Date() })
      .where(eq(apps.personId, p.kai))
      .returning();
    const id = app?.id ?? "";
    await getDb()
      .insert(applicantDocuments)
      .values(REQUIRED_DOCS.map((d) => ({ applicationId: id, docKey: d.key, doneAt: new Date() })));

    const tileIds = async () => (await landingFor(p.camp)).tiles.map((t) => t.id);
    expect(await tileIds()).toContain("applicants");
    await setFlagAs(p.admin, "applicants", { enabled: false });
    for (const who of [p.kai, p.camp, p.lead])
      expect(await layoutStatus("applicants", who)).toBe("404");
    expect(await tileIds()).not.toContain("applicants");

    await actAs(p.kai);
    await expect(
      ok(saveApplication({ answers: GOOD_ANSWERS, submit: true })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.camp);
    await expect(ok(updateApplication({ id, note: "x" }))).rejects.toBeInstanceOf(ForbiddenError);

    await seedEventsFor("finance").emit("finance.fee.paid", {
      v: 1,
      feeId: randomUUID(),
      personId: p.kai,
      editionId: EDITION.id,
      paidAt: new Date().toISOString(),
      source: { refType: "applicants.application", refId: id },
    });
    expect((await dispatchPending()).skipped).toBeGreaterThanOrEqual(1);
    const after = (await getDb().select().from(apps).where(eq(apps.id, id)))[0];
    expect(after).toMatchObject({ status: "accepted", paidAt: null }); // not joined, data kept

    await setFlagAs(p.admin, "applicants", { enabled: true });
    expect(await layoutStatus("applicants", p.kai)).toBe("ok");
  });
});
