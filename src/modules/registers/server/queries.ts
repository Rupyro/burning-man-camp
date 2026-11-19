import { asc, eq } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { registersItems } from "../schema";

/** Every register line for one edition, by kind then label, with the owner's name. */
export async function listItems(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      id: registersItems.id,
      kind: registersItems.kind,
      label: registersItems.label,
      quantity: registersItems.quantity,
      pulled: registersItems.pulled,
      location: registersItems.location,
      notes: registersItems.notes,
      owner: people.displayName,
    })
    .from(registersItems)
    .leftJoin(people, eq(people.id, registersItems.ownerPersonId))
    .where(eq(registersItems.editionId, editionId))
    .orderBy(asc(registersItems.kind), asc(registersItems.label));
}
export type RegisterRow = Awaited<ReturnType<typeof listItems>>[number];
