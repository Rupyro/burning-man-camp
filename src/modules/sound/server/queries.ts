import { desc, eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { soundNeighborLog, soundPlans } from "../schema";

export const DEFAULT_PLAN = {
  quietFrom: "03:00",
  quietUntil: "10:00",
  maxDb: 100,
  speakersFace: null as string | null,
  notes: null as string | null,
};
export type SoundPlan = typeof DEFAULT_PLAN;

export async function getPlan(db: ReadOnlyDb, editionId: string): Promise<SoundPlan> {
  const [row] = await db.select().from(soundPlans).where(eq(soundPlans.editionId, editionId));
  return row ?? DEFAULT_PLAN;
}

/** The neighbor log, newest first, with who logged it. */
export async function listLog(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      id: soundNeighborLog.id,
      at: soundNeighborLog.at,
      neighbor: soundNeighborLog.neighbor,
      what: soundNeighborLog.what,
      action: soundNeighborLog.action,
      loggedBy: people.displayName,
    })
    .from(soundNeighborLog)
    .leftJoin(people, eq(people.id, soundNeighborLog.loggedByPersonId))
    .where(eq(soundNeighborLog.editionId, editionId))
    .orderBy(desc(soundNeighborLog.at));
}
