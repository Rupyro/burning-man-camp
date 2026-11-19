import { asc, eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { villageShares } from "../schema";

/** Every share for one edition, by partner camp then item. */
export async function listShares(db: ReadOnlyDb, editionId: string) {
  return db
    .select()
    .from(villageShares)
    .where(eq(villageShares.editionId, editionId))
    .orderBy(asc(villageShares.partner), asc(villageShares.item));
}
export type ShareRow = Awaited<ReturnType<typeof listShares>>[number];
