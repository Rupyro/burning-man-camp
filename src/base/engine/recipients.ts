// Who leads a team, and who holds a role this edition: shared by alerts and automations.
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import { roleAssignments, roles, teamMemberships } from "../schema";

/** A team's leads and co-leads. */
export async function teamLeadIds(db: DbOrTx, teamId: string): Promise<string[]> {
  const rows = await db
    .select({ id: teamMemberships.personId })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        inArray(teamMemberships.role, ["lead", "co_lead"]),
        isNull(teamMemberships.deletedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/** Current holders of a role (camp-wide or this edition, not ended). */
export async function roleHolderIds(
  db: DbOrTx,
  role: string,
  edition: EditionRef,
  now: Date,
): Promise<string[]> {
  const rows = await db
    .select({ id: roleAssignments.personId })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(
      and(
        eq(roles.key, role),
        isNull(roleAssignments.deletedAt),
        or(isNull(roleAssignments.editionId), eq(roleAssignments.editionId, edition.id)),
        or(isNull(roleAssignments.endsAt), gt(roleAssignments.endsAt, now)),
      ),
    );
  return [...new Set(rows.map((r) => r.id))];
}
