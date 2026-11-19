import { and, asc, eq, isNull } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { editionMembers, people } from "@/base/api/schema";
import type { Allocations, TicketRow } from "../rules/gate";
import { ticketsAllocations, ticketsStatus } from "../schema";

const NONE: TicketRow = { ticket: "none", vehiclePass: "not_needed", earlyArrival: "no" };

export async function myTickets(db: ReadOnlyDb, editionId: string, personId: string) {
  const [row] = await db
    .select()
    .from(ticketsStatus)
    .where(and(eq(ticketsStatus.editionId, editionId), eq(ticketsStatus.personId, personId)))
    .limit(1);
  return row ?? { ...NONE, note: null };
}

export async function getAllocations(db: ReadOnlyDb, editionId: string): Promise<Allocations> {
  const [row] = await db
    .select()
    .from(ticketsAllocations)
    .where(eq(ticketsAllocations.editionId, editionId))
    .limit(1);
  return row ?? { stewards: 0, vehiclePasses: 0, earlyPasses: 0 };
}

/** Every confirmed member this edition with their status (no row = nothing yet). */
export async function campTickets(db: ReadOnlyDb, editionId: string) {
  const rows = await db
    .select({
      personId: people.id,
      name: people.displayName,
      ticket: ticketsStatus.ticket,
      vehiclePass: ticketsStatus.vehiclePass,
      earlyArrival: ticketsStatus.earlyArrival,
      note: ticketsStatus.note,
    })
    .from(editionMembers)
    .innerJoin(people, eq(people.id, editionMembers.personId))
    .leftJoin(
      ticketsStatus,
      and(eq(ticketsStatus.personId, people.id), eq(ticketsStatus.editionId, editionId)),
    )
    .where(
      and(
        eq(editionMembers.editionId, editionId),
        eq(editionMembers.status, "confirmed"),
        isNull(editionMembers.deletedAt),
        isNull(people.deletedAt),
      ),
    )
    .orderBy(asc(people.displayName));
  return rows.map((r) => ({
    personId: r.personId,
    name: r.name,
    note: r.note,
    ticket: r.ticket ?? NONE.ticket,
    vehiclePass: r.vehiclePass ?? NONE.vehiclePass,
    earlyArrival: r.earlyArrival ?? NONE.earlyArrival,
  }));
}
