import { asc, eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { scheduleEvents } from "../schema";

/** The camp's events for one edition, in time order, with the host's name. */
export async function listEvents(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      id: scheduleEvents.id,
      title: scheduleEvents.title,
      description: scheduleEvents.description,
      category: scheduleEvents.category,
      startsAt: scheduleEvents.startsAt,
      endsAt: scheduleEvents.endsAt,
      location: scheduleEvents.location,
      host: people.displayName,
    })
    .from(scheduleEvents)
    .leftJoin(people, eq(people.id, scheduleEvents.hostPersonId))
    .where(eq(scheduleEvents.editionId, editionId))
    .orderBy(asc(scheduleEvents.startsAt));
}
export type ScheduleRow = Awaited<ReturnType<typeof listEvents>>[number];
