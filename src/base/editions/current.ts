import { desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { campSettings, editions } from "../schema";

export interface EditionRef {
  id: string;
  year: number;
}

/** camp_settings.current_edition_id, else the latest planning/active edition. */
export async function getCurrentEdition(db: DbOrTx): Promise<EditionRef | null> {
  const [settings] = await db
    .select({ id: editions.id, year: editions.year })
    .from(campSettings)
    .innerJoin(editions, eq(editions.id, campSettings.currentEditionId))
    .limit(1);
  if (settings) return settings;
  const [latest] = await db
    .select({ id: editions.id, year: editions.year })
    .from(editions)
    .where(inArray(editions.status, ["planning", "active"]))
    .orderBy(desc(editions.year))
    .limit(1);
  return latest ?? null;
}
