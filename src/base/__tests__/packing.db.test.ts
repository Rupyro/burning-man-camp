// Packing ticks: only ever the caller's own, only real list items, toggles cleanly.
import { describe, expect, it } from "vitest";
import { actorFor, createPerson, EDITION, getDb } from "@/base/api/testing-db";
import { myPackingTicks, setMyPackingTick } from "../people/packing";

async function ctxFor(personId: string) {
  return { actor: await actorFor(personId), edition: EDITION, db: getDb(), now: new Date() };
}

describe("packing ticks", () => {
  it("ticks and unticks my own items, and refuses unknown items", async () => {
    const me = await createPerson({ email: "pack@example.test", name: "Mia Demo" });
    const ctx = await ctxFor(me);
    expect(await myPackingTicks(ctx)).toEqual([]);
    await setMyPackingTick(ctx, "drinking-water", true);
    await setMyPackingTick(ctx, "drinking-water", true);
    await setMyPackingTick(ctx, "towel", true);
    expect((await myPackingTicks(ctx)).sort()).toEqual(["drinking-water", "towel"]);
    await setMyPackingTick(ctx, "towel", false);
    expect(await myPackingTicks(ctx)).toEqual(["drinking-water"]);
    await expect(setMyPackingTick(ctx, "a-camping-chair", true)).rejects.toThrow();
    const other = await ctxFor(await createPerson({ email: "o@example.test", name: "Thabo Demo" }));
    expect(await myPackingTicks(other)).toEqual([]);
  });
  it("needs a signed-in person", async () => {
    const ctx = { ...(await ctxFor(await createPerson({ email: "x@example.test", name: "X" }))) };
    const anon = { ...ctx, actor: { ...ctx.actor, personId: null } } as typeof ctx;
    await expect(setMyPackingTick(anon, "towel", true)).rejects.toThrow();
    expect(await myPackingTicks(anon)).toEqual([]);
  });
});
