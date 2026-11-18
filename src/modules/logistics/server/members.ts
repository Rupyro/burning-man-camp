// Confirmed members for the WAP list and the arrival manifest (L5): names, emails, build
// commitment and arrival day only. Nothing else leaves the base profile.
import { and, eq, isNull } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { editionMembers, people } from "@/base/api/schema";
import { formatCampDay } from "@/lib/dates";
import type { MemberRow } from "../rules/exports";

export async function membersFor(db: ReadOnlyDb, editionId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      name: people.displayName,
      email: people.email,
      status: editionMembers.status,
      buildCommitment: editionMembers.buildCommitment,
      arrivalAt: editionMembers.arrivalAt,
    })
    .from(editionMembers)
    .innerJoin(people, eq(people.id, editionMembers.personId))
    .where(and(eq(editionMembers.editionId, editionId), isNull(people.deletedAt)));
  return rows.map((r) => ({
    name: r.name,
    email: r.email,
    status: r.status,
    buildCommitment: r.buildCommitment,
    arrivalDay: r.arrivalAt ? formatCampDay(r.arrivalAt, "yyyy-MM-dd") : null,
  }));
}
