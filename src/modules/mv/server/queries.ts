import { eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { mvDrivers } from "../schema";

/** Everyone who offered to drive this edition, with their name. */
export async function listDrivers(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      id: mvDrivers.id,
      personId: mvDrivers.personId,
      name: people.displayName,
      cleared: mvDrivers.cleared,
      note: mvDrivers.note,
    })
    .from(mvDrivers)
    .innerJoin(people, eq(people.id, mvDrivers.personId))
    .where(eq(mvDrivers.editionId, editionId));
}
export type DriverRow = Awaited<ReturnType<typeof listDrivers>>[number];
