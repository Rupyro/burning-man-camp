// Loads through the guard: who can manage them, the status machine, delivery stamps, gaps, and the
// procurement.need.marked_critical handler (spec §3, §4, §6; L1, L2, L8; PLAN "Done when").
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, baseTables, dispatchPending, EDITION, getDb } from "@/base/api/testing-db";
import { eventContracts } from "@/contracts/events";
import { logisticsLoadItems } from "../schema";
import {
  addItem,
  assignItem,
  confirmDelivery,
  createLoad,
  createPlace,
  createVehicle,
  moveLoad,
  packItem,
  updateLoad,
} from "../server/loads";
import { criticalGaps, getLoad, itemsOf, listLoads } from "../server/queries";
import { logisticsCamp } from "./fixtures";

const { domainEvents, domainEventDeliveries, auditEvents } = baseTables;
let p: Awaited<ReturnType<typeof logisticsCamp>>;
const load = (id: string) => getLoad(getDb(), EDITION.id, id);

async function newLoad(dest: string | null = null) {
  await actAs(p.logi);
  const r = await ok(
    createLoad({
      name: "Truck 1 to site",
      direction: "outbound",
      originPlaceId: p.place.storage,
      destinationPlaceId: dest,
      departsAt: "2027-04-20T07:00:00+02:00",
    }),
  );
  return r.id;
}

async function markedCritical(needId = "01900000-0000-7000-8000-0000000000a1") {
  const payload = {
    v: 1 as const,
    needId,
    teamId: "01900000-0000-7000-8000-0000000000b1",
    itemName: "Generator 5 kVA",
    quantity: 2,
    unit: "pcs",
    neededBy: "2027-04-18",
    editionId: EDITION.id,
  };
  eventContracts["procurement.need.marked_critical"].parse(payload);
  const [e] = await getDb()
    .insert(domainEvents)
    .values({
      name: "procurement.need.marked_critical",
      version: 1,
      payload,
      emittedByModule: "procurement",
      editionId: EDITION.id,
    })
    .returning();
  await getDb()
    .insert(domainEventDeliveries)
    .values({ eventId: e?.id ?? "", handlerModule: "logistics", nextAttemptAt: new Date(0) });
  return e;
}

describe("loads", () => {
  beforeEach(async () => {
    p = await logisticsCamp();
  });

  it("the Logistics team and camp leads manage loads; other members and team leads can't (L1)", async () => {
    for (const who of [p.member, p.kitchenLead, p.waitlisted]) {
      await actAs(who);
      await expect(ok(createLoad({ name: "X", direction: "outbound" }))).rejects.toThrow(
        ForbiddenError,
      );
    }
    await actAs(p.camp);
    expect((await ok(createLoad({ name: "Camp lead's load", direction: "return" }))).ok).toBe(true);
    await actAs(p.logi);
    await ok(createPlace({ name: "Container yard", kind: "container_yard" }));
    await expect(ok(createPlace({ name: "container YARD", kind: "storage" }))).rejects.toThrow(
      ValidationError,
    );
    await ok(
      createVehicle({
        label: "Bakkie (Lex)",
        kind: "bakkie",
        driverPersonId: p.logiLead,
        seats: 3,
      }),
    );
  });

  it("moves through the status machine with an audit entry each time; delivered is final", async () => {
    const id = await newLoad(p.place.site);
    await ok(moveLoad({ loadId: id, to: "packing" }));
    await expect(ok(moveLoad({ loadId: id, to: "planned" }))).resolves.toBeTruthy();
    await ok(moveLoad({ loadId: id, to: "packing" }));
    await ok(moveLoad({ loadId: id, to: "in_transit" }));
    await expect(ok(moveLoad({ loadId: id, to: "delivered" }))).rejects.toThrow(/Confirm delivery/);
    // Any team lead can confirm a delivery on site (L2); a plain member can't.
    await actAs(p.member);
    await expect(ok(confirmDelivery({ loadId: id }))).rejects.toThrow(ForbiddenError);
    await actAs(p.kitchenLead);
    expect(await ok(confirmDelivery({ loadId: id }))).toEqual({ ok: true, already: false });
    expect(await ok(confirmDelivery({ loadId: id }))).toEqual({ ok: true, already: true });
    const row = await load(id);
    expect(row?.status).toBe("delivered");
    expect(row?.deliveredByName).toBe("Alex");
    expect(row?.deliveredConfirmedAt).toBeInstanceOf(Date);
    await actAs(p.logi);
    await expect(ok(moveLoad({ loadId: id, to: "cancelled" }))).rejects.toThrow(ValidationError);
    const audits = await getDb().select().from(auditEvents).where(eq(auditEvents.entityId, id));
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        "logistics.load.created",
        "logistics.load.moved",
        "logistics.load.delivered",
      ]),
    );
  });

  it("can't deliver a load that never left", async () => {
    const id = await newLoad(p.place.site);
    await expect(ok(confirmDelivery({ loadId: id }))).rejects.toThrow(/on the road/);
  });

  it("edits a load with a version check and logs only what changed", async () => {
    const id = await newLoad();
    const before = await load(id);
    const r = await ok(
      updateLoad({
        loadId: id,
        version: before?.version ?? 0,
        destinationPlaceId: p.place.site,
      }),
    );
    expect(r.changed).toBe(true);
    await expect(
      ok(updateLoad({ loadId: id, version: before?.version ?? 0, name: "Late edit" })),
    ).rejects.toThrow(/Someone else/);
    const now = await load(id);
    expect(
      await ok(
        updateLoad({
          loadId: id,
          version: now?.version ?? 0,
          destinationPlaceId: p.place.site,
        }),
      ),
    ).toEqual({
      ok: true,
      changed: false,
    });
    expect(now?.destinationName).toBe("Tankwa site");
    await expect(
      ok(
        updateLoad({
          loadId: id,
          version: now?.version ?? 0,
          originPlaceId: "01900000-0000-7000-8000-00000000dead",
        }),
      ),
    ).rejects.toThrow(/Pick a place/);
  });

  it("items: add, pack, and the counts on the loads list", async () => {
    const id = await newLoad(p.place.site);
    const a = await ok(
      addItem({
        loadId: id,
        description: "Shade cloth 6x6",
        quantity: "4",
        unit: "pcs",
      }),
    );
    await ok(
      addItem({
        loadId: id,
        description: "Water 25 L",
        quantity: "20",
        unit: "pcs",
        isCritical: true,
      }),
    );
    await expect(ok(addItem({ loadId: id, description: "Zero", quantity: "0" }))).rejects.toThrow(
      ValidationError,
    );
    await ok(packItem({ itemId: a.id, packed: true }));
    expect((await ok(packItem({ itemId: a.id, packed: true }))).changed).toBe(false);
    const [row] = await listLoads(getDb(), EDITION.id);
    expect(row).toMatchObject({ itemCount: 2, packedCount: 1, criticalCount: 1 });
    const items = await itemsOf(getDb(), id);
    expect(items[0]?.description).toBe("Water 25 L");
    const loose = await ok(addItem({ description: "Spare tarp" }));
    await expect(ok(packItem({ itemId: loose.id, packed: true }))).rejects.toThrow(
      /on a load first/,
    );
  });
});

describe("critical gaps (L8) and the marked_critical handler", () => {
  beforeEach(async () => {
    p = await logisticsCamp();
  });

  it("a need marked critical becomes one unassigned critical item, even if delivered twice", async () => {
    const e = await markedCritical();
    await dispatchPending();
    await getDb()
      .insert(domainEventDeliveries)
      .values({ eventId: e?.id ?? "", handlerModule: "logistics", nextAttemptAt: new Date(0) })
      .onConflictDoNothing();
    await dispatchPending();
    const rows = await getDb().select().from(logisticsLoadItems);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Generator 5 kVA",
      quantity: 2,
      isCritical: true,
      loadId: null,
      sourceRefType: "procurement.need",
      neededBy: "2027-04-18",
    });
    const gaps = await criticalGaps(getDb(), EDITION.id);
    expect(gaps.map((g) => g.reason)).toEqual(["no_load"]);
  });

  it("stays a gap until it's on an open load with a destination", async () => {
    await markedCritical();
    await dispatchPending();
    const [item] = await getDb().select().from(logisticsLoadItems);
    const id = await newLoad();
    await ok(assignItem({ itemId: item?.id ?? "", loadId: id }));
    expect((await criticalGaps(getDb(), EDITION.id))[0]?.reason).toBe("no_destination");
    const l = await load(id);
    await ok(
      updateLoad({ loadId: id, version: l?.version ?? 0, destinationPlaceId: p.place.site }),
    );
    expect(await criticalGaps(getDb(), EDITION.id)).toEqual([]);
    await ok(moveLoad({ loadId: id, to: "cancelled" }));
    expect((await criticalGaps(getDb(), EDITION.id))[0]?.reason).toBe("load_cancelled");
    await expect(ok(assignItem({ itemId: item?.id ?? "", loadId: id }))).resolves.toMatchObject({
      changed: false,
    });
    const other = await newLoad(p.place.site);
    await ok(assignItem({ itemId: item?.id ?? "", loadId: other }));
    expect(await criticalGaps(getDb(), EDITION.id)).toEqual([]);
    await actAs(p.member);
    await expect(ok(assignItem({ itemId: item?.id ?? "", loadId: null }))).rejects.toThrow(
      ForbiddenError,
    );
  });
});
