// Edition settings screen: the server read and the save actions (spec b1-12 E1–E4).
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, EDITION, getDb } from "@/base/api/testing-db";
import { getEditionSettings } from "@/base/editions/settings";
import { ForbiddenError } from "@/base/errors";
import { saveAnchorDate, saveEdition } from "@/base/people/server/actions";
import { anchorDates, auditEvents } from "@/base/schema";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;

const anchor = (over: Record<string, unknown> = {}) => ({
  key: "build_start",
  label: "Build",
  startsAt: "2027-04-21T06:00:00Z",
  isConfirmed: false,
  ...over,
});

describe("edition settings", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("E1: the camp lead sees title, capacity, confirmed count and key dates in order", async () => {
    await actAs(ids.camp);
    await ok(
      saveAnchorDate(
        anchor({ key: "event_start", label: "Event", startsAt: "2027-04-26T06:00:00Z" }),
      ),
    );
    await ok(saveAnchorDate(anchor()));
    const s = await getEditionSettings(await as(ids.camp));
    expect(s.title).toBe("Burning Man 2027");
    expect(s.year).toBe(2027);
    expect(s.confirmed).toBeGreaterThan(0);
    expect(s.anchors.map((a) => a.key)).toEqual(["build_start", "event_start"]);
    expect(s.anchors[0]?.isConfirmed).toBe(false);
  });

  it("E2 (deny): members and team leads can't read or change the settings", async () => {
    await expect(getEditionSettings(await as(ids.gift))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getEditionSettings(await as(ids.lead))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(ids.lead);
    await expect(ok(saveAnchorDate(anchor()))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(ok(saveEdition({ title: "Hacked" }))).rejects.toBeInstanceOf(ForbiddenError);
    const rows = await getDb().select().from(anchorDates);
    expect(rows).toHaveLength(0);
  });

  it("E3: saves end date and source note, audits, and the same key edits instead of adding", async () => {
    await actAs(ids.camp);
    const first = await ok(
      saveAnchorDate(anchor({ endsAt: "2027-04-25T16:00:00Z", sourceNote: "camp draft (FLOW)" })),
    );
    expect(first.ok).toBe(true);
    const again = await ok(saveAnchorDate(anchor({ label: "Build week", isConfirmed: true })));
    expect(again.ok).toBe(true);
    const rows = await getDb()
      .select()
      .from(anchorDates)
      .where(and(eq(anchorDates.editionId, EDITION.id), eq(anchorDates.key, "build_start")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Build week", isConfirmed: true });
    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "edition.anchor_set"));
    expect(audits).toHaveLength(2);
  });

  it("E3: the first save keeps the end date and the source note", async () => {
    await actAs(ids.camp);
    await ok(saveAnchorDate(anchor({ endsAt: "2027-04-25T16:00:00Z", sourceNote: "camp draft" })));
    const s = await getEditionSettings(await as(ids.camp));
    expect(s.anchors[0]?.endsAt?.toISOString()).toBe("2027-04-25T16:00:00.000Z");
    expect(s.anchors[0]?.sourceNote).toBe("camp draft");
  });

  it("E4: an end before the start is refused with a message and nothing is saved", async () => {
    await actAs(ids.camp);
    const r = await ok(saveAnchorDate(anchor({ endsAt: "2027-04-20T06:00:00Z" })));
    expect(r).toEqual({ ok: false, error: "An anchor date can't end before it starts" });
    expect(await getDb().select().from(anchorDates)).toHaveLength(0);
  });

  it("admins can change capacity and the new number shows on the screen", async () => {
    await actAs(ids.admin);
    expect((await ok(saveEdition({ memberCapacity: 64 }))).ok).toBe(true);
    expect((await getEditionSettings(await as(ids.admin))).capacity).toBe(64);
  });
});
