import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { people } from "@/base/api/schema";
import { financeCampFees as fees } from "../schema";

/** This edition's camp fees, due first (money people only: the page checks the capability). */
export async function listFees(db: ModuleContext["db"], editionId: string) {
  return db
    .select({
      id: fees.id,
      personId: fees.personId,
      name: people.displayName,
      amountCents: fees.amountCents,
      status: fees.status,
      paidAt: fees.paidAt,
      createdAt: fees.createdAt,
    })
    .from(fees)
    .innerJoin(people, eq(people.id, fees.personId))
    .where(eq(fees.editionId, editionId))
    .orderBy(asc(fees.status), desc(fees.createdAt));
}
