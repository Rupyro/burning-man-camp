import type { ModuleSeedContext } from "@/base/api";
import { ticketsAllocations, ticketsStatus } from "./schema";

/** Fake, idempotent: a small allocation and three people at different stages. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  await db
    .insert(ticketsAllocations)
    .values({ editionId: edition.id, stewards: 6, vehiclePasses: 4, earlyPasses: 5 })
    .onConflictDoNothing();
  await db
    .insert(ticketsStatus)
    .values([
      { editionId: edition.id, personId: people.admin, ticket: "have", earlyArrival: "have" },
      {
        editionId: edition.id,
        personId: people.lead,
        ticket: "stewards_offered",
        vehiclePass: "need",
        earlyArrival: "requested",
      },
      { editionId: edition.id, personId: people.member, ticket: "looking" },
    ])
    .onConflictDoNothing();
}
