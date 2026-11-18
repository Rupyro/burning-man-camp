// Fake, deterministic, idempotent demo logistics (docs/specs/logistics.md §7). Writes only
// logistics tables; people come from the base seed (fake names, example.test emails, 555 phones).
import { and, asc, eq, like } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { editionMembers, people } from "@/base/api/schema";
import { campInputToInstant } from "@/lib/dates";
import type { LoadStatus } from "./rules/loads";
import {
  logisticsLoadItems,
  logisticsLoads,
  logisticsPlaces,
  logisticsRideMatches,
  logisticsTravelPlans,
  logisticsVehicles,
} from "./schema";

const PLACES = [
  ["Cape Town storage", "storage", "Fake storage unit (demo), Paarden Eiland"],
  ["Container yard (demo)", "container_yard", "Where the containers wait between burns"],
  ["Tankwa site", "site", "Our spot on the playa"],
  ["Observatory", "city_area", null],
  ["Southern Suburbs", "city_area", null],
  ["Stellenbosch", "city_area", null],
  ["Cape Town airport", "airport", null],
] as const;

const VEHICLES = [
  ["Hired 8-ton truck (demo)", "truck", 2, "8 t, tail lift"],
  ["Lex's bakkie (demo)", "bakkie", 3, "Canopy, tow bar"],
  ["Container truck: Container A", "container_truck", 1, "Container A on and off site"],
  ["Trailer (camp)", "trailer", null, "2.5 m, needs a tow bar"],
] as const;

type LoadSeed = [
  name: string,
  vehicle: number | null,
  from: number,
  to: number | null,
  departs: [string, string] | null,
  status: LoadStatus,
  items: [desc: string, qty: number, unit: string, critical?: boolean, packed?: boolean][],
];

const LOADS: LoadSeed[] = [
  [
    "Container A to site",
    2,
    1,
    2,
    ["2027-04-16", "06:00"],
    "packing",
    [
      ["Shade cloth 6x6", 12, "pcs", false, true],
      ["Scaffold poles", 40, "pcs", false, true],
      ["Generator 5 kVA", 1, "pcs", true, false],
      ["Staple guns", 2, "pcs", false, false],
    ],
  ],
  [
    "Truck 1: kitchen and water",
    0,
    0,
    2,
    ["2027-04-19", "07:00"],
    "planned",
    [
      ["Water 25 L", 40, "pcs", true],
      ["Gas bottles 9 kg", 6, "pcs", true],
      ["Kitchen crates", 14, "pcs"],
      ["Chest freezers", 2, "pcs"],
    ],
  ],
  [
    "Bakkie run: art car parts",
    1,
    5,
    null,
    ["2027-04-20", "09:00"],
    "planned",
    [["Steel for the art car", 1, "lot", true]],
  ],
  [
    "Early build kit",
    1,
    0,
    2,
    ["2027-04-12", "08:00"],
    "delivered",
    [
      ["Tent pegs (big)", 200, "pcs", false, true],
      ["Rope 50 m", 6, "pcs", false, true],
    ],
  ],
  ["Strike: container back", 2, 2, 1, ["2027-05-04", "10:00"], "planned", []],
];

/** Who travels how (by fake member index), [direction, mode, day, area, seats]. */
const TRAVEL: [
  number,
  "to_burn" | "from_burn",
  "offering_ride" | "need_ride" | "own_arrangement",
  string,
  number | null,
  number,
][] = [
  [0, "to_burn", "offering_ride", "2027-04-21", 3, 3],
  [1, "to_burn", "offering_ride", "2027-04-22", 4, 2],
  [2, "to_burn", "offering_ride", "2027-04-21", 5, 2],
  [3, "to_burn", "need_ride", "2027-04-21", 3, 1],
  [4, "to_burn", "need_ride", "2027-04-22", 4, 1],
  [5, "to_burn", "need_ride", "2027-04-23", null, 2],
  [6, "to_burn", "own_arrangement", "2027-04-20", null, 0],
  [7, "to_burn", "need_ride", "2027-04-22", 6, 1],
  [8, "to_burn", "own_arrangement", "2027-04-19", null, 0],
  [9, "to_burn", "offering_ride", "2027-04-24", 3, 1],
  [0, "from_burn", "offering_ride", "2027-05-03", 3, 3],
  [3, "from_burn", "need_ride", "2027-05-03", 3, 1],
  [4, "from_burn", "need_ride", "2027-05-04", null, 1],
  [10, "from_burn", "own_arrangement", "2027-05-02", null, 0],
];

export async function seed({ db, edition, people: demo }: ModuleSeedContext) {
  const [done] = await db.select({ id: logisticsPlaces.id }).from(logisticsPlaces).limit(1);
  if (done) return;
  const places = await db
    .insert(logisticsPlaces)
    .values(PLACES.map(([name, kind, addressText]) => ({ name, kind, addressText })))
    .returning();
  const placeId = (i: number | null) => (i === null ? null : (places[i]?.id ?? null));

  // Fake confirmed members (not the demo accounts), in a stable order.
  const fake = await db
    .select({ id: people.id, name: people.displayName })
    .from(people)
    .innerJoin(editionMembers, eq(editionMembers.personId, people.id))
    .where(
      and(
        eq(editionMembers.editionId, edition.id),
        eq(editionMembers.status, "confirmed"),
        // The base seed's fake members are first.last@example.test; demo accounts have no dot.
        like(people.email, "%.%@example.test"),
      ),
    )
    .orderBy(asc(people.email))
    .limit(20);
  const person = (i: number) => fake[i]?.id ?? demo.lead;

  const vehicles = await db
    .insert(logisticsVehicles)
    .values(
      VEHICLES.map(([label, kind, seats, cargoNotes], i) => ({
        editionId: edition.id,
        label,
        kind,
        seats,
        cargoNotes,
        driverPersonId: i === 1 ? person(0) : null,
      })),
    )
    .returning();

  for (const [name, v, from, to, departs, status, items] of LOADS) {
    const [load] = await db
      .insert(logisticsLoads)
      .values({
        editionId: edition.id,
        name,
        direction: name.startsWith("Strike") ? "return" : "outbound",
        vehicleId: v === null ? null : (vehicles[v]?.id ?? null),
        originPlaceId: placeId(from),
        destinationPlaceId: placeId(to),
        departsAt: departs ? campInputToInstant(departs[0], departs[1]) : null,
        status,
        deliveredConfirmedAt:
          status === "delivered" ? campInputToInstant("2027-04-12", "15:30") : null,
        deliveredConfirmedByPersonId: status === "delivered" ? demo.lead : null,
      })
      .returning();
    if (!items.length) continue;
    await db.insert(logisticsLoadItems).values(
      items.map(([description, quantity, unit, critical, packed]) => ({
        editionId: edition.id,
        loadId: load?.id ?? null,
        description,
        quantity,
        unit,
        isCritical: critical ?? false,
        packedAt: packed ? campInputToInstant("2027-04-10", "12:00") : null,
        packedByPersonId: packed ? person(0) : null,
      })),
    );
  }
  // Critical items not on a load yet: these are the gaps leads see first.
  await db.insert(logisticsLoadItems).values([
    {
      editionId: edition.id,
      description: "Medical kit (large)",
      isCritical: true,
      neededBy: "2027-04-18",
    },
    {
      editionId: edition.id,
      description: "Fire extinguisher 9 kg",
      quantity: 2,
      isCritical: true,
      neededBy: "2027-04-16",
    },
    { editionId: edition.id, description: "Spare tarps", quantity: 4 },
  ]);

  const planRows = await db
    .insert(logisticsTravelPlans)
    .values(
      TRAVEL.map(([who, direction, mode, travelDate, area, seats]) => ({
        editionId: edition.id,
        personId: person(who),
        direction,
        mode,
        travelDate,
        areaPlaceId: placeId(area),
        seatsOffered: mode === "offering_ride" ? seats : null,
        seatsNeeded: mode === "need_ride" ? seats : null,
        timeOfDay: who % 2 ? ("morning" as const) : ("flexible" as const),
        carriesCargo: mode === "offering_ride" && who === 0,
      })),
    )
    .returning();
  const plan = (who: number, dir: string) =>
    planRows.find((p) => p.personId === person(who) && p.direction === dir)?.id ?? "";
  // The demo member needs a ride in and offers one home; one ask waits for them as a driver.
  const [, memberOut] = await db
    .insert(logisticsTravelPlans)
    .values([
      {
        editionId: edition.id,
        personId: demo.member,
        direction: "to_burn" as const,
        mode: "need_ride" as const,
        travelDate: "2027-04-21",
        areaPlaceId: placeId(3),
        seatsNeeded: 1,
      },
      {
        editionId: edition.id,
        personId: demo.member,
        direction: "from_burn" as const,
        mode: "offering_ride" as const,
        travelDate: "2027-05-03",
        areaPlaceId: placeId(3),
        seatsOffered: 2,
      },
    ])
    .returning();
  const asked = campInputToInstant("2027-03-30", "19:00");
  await db.insert(logisticsRideMatches).values([
    {
      driverPlanId: plan(0, "to_burn"),
      passengerPlanId: plan(3, "to_burn"),
      status: "accepted",
      askedAt: asked,
      decidedAt: asked,
    },
    {
      driverPlanId: plan(1, "to_burn"),
      passengerPlanId: plan(4, "to_burn"),
      status: "proposed",
      askedAt: asked,
    },
    {
      driverPlanId: plan(0, "from_burn"),
      passengerPlanId: plan(3, "from_burn"),
      status: "accepted",
      askedAt: asked,
      decidedAt: asked,
    },
    {
      driverPlanId: memberOut?.id ?? "",
      passengerPlanId: plan(4, "from_burn"),
      status: "proposed",
      askedAt: asked,
    },
  ]);
}
