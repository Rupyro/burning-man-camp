import { asc, eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { exodusDepartures } from "../schema";

/** Everyone's departure for one edition, earliest first, with their name. */
export async function listDepartures(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      personId: exodusDepartures.personId,
      name: people.displayName,
      departsAt: exodusDepartures.departsAt,
      staysForSweep: exodusDepartures.staysForSweep,
      travel: exodusDepartures.travel,
    })
    .from(exodusDepartures)
    .innerJoin(people, eq(people.id, exodusDepartures.personId))
    .where(eq(exodusDepartures.editionId, editionId))
    .orderBy(asc(exodusDepartures.departsAt));
}
export type DepartureRow = Awaited<ReturnType<typeof listDepartures>>[number];
