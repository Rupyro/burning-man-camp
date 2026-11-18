// "Rides to camp" board page: everyone's offers and requests, one direction at a time.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { saveTravel } from "../server/travel";
import { RidesBoardPage } from "../ui/pages/board";
import { logisticsCamp } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof logisticsCamp>>;
const ctxFor = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});

describe("rides to camp board", () => {
  beforeEach(async () => {
    p = await logisticsCamp();
  });

  it("is empty at first, with ways to offer or find a ride", async () => {
    const out = renderToStaticMarkup(
      await RidesBoardPage({ ctx: await ctxFor(p.member), back: false }),
    );
    expect(out).toContain("Rides to camp");
    expect(out).toContain("Offer a ride");
    expect(out).toContain("Find a ride");
    expect(out).toContain("No rides on the board yet");
  });

  it("shows offers and requests with seats, from, leaving, gear space and status", async () => {
    await actAs(p.logiLead);
    await ok(
      saveTravel({
        direction: "to_burn",
        mode: "offering_ride",
        travelDate: "2027-04-21",
        areaPlaceId: p.place.obs,
        seats: 2,
        notes: "Room for 2 big backpacks and 50 L of water",
      }),
    );
    await actAs(p.member);
    await ok(
      saveTravel({
        direction: "to_burn",
        mode: "need_ride",
        travelDate: "2027-04-22",
        areaPlaceId: p.place.obs,
      }),
    );
    await ok(saveTravel({ direction: "from_burn", mode: "need_ride", travelDate: "2027-05-03" }));
    const out = renderToStaticMarkup(
      await RidesBoardPage({ ctx: await ctxFor(p.member), back: false }),
    );
    expect(out).toContain("Offering a ride");
    expect(out).toContain("Looking for a ride");
    expect(out).toContain("2 seats free");
    expect(out).toContain("Space available");
    expect(out).toContain("Still looking");
    expect(out).toContain("Room for 2 big backpacks");
    expect(out).toContain("(you)");
    expect(out).not.toContain("2027-05-03");
    const back = renderToStaticMarkup(
      await RidesBoardPage({ ctx: await ctxFor(p.member), back: true }),
    );
    expect(back).toContain("Home from the burn");
    expect(back).not.toContain("Room for 2 big backpacks");
  });
});
