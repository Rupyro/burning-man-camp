import { and, eq, inArray, isNull } from "drizzle-orm";
import type { PersonResource } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import { people, teamMemberships, teams } from "../schema";

export interface TeamRef {
  id: string;
  key: string;
  name: string;
  role: "lead" | "co_lead" | "member";
}

/** Each person's teams this edition, keyed by person id. */
export async function teamsByPerson(
  db: DbOrTx,
  edition: EditionRef,
  personIds: string[],
): Promise<Map<string, TeamRef[]>> {
  const out = new Map<string, TeamRef[]>();
  if (!personIds.length) return out;
  const rows = await db
    .select({
      personId: teamMemberships.personId,
      id: teams.id,
      key: teams.key,
      name: teams.name,
      role: teamMemberships.role,
    })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(
      and(
        inArray(teamMemberships.personId, personIds),
        eq(teams.editionId, edition.id),
        isNull(teamMemberships.deletedAt),
        isNull(teams.deletedAt),
      ),
    )
    .orderBy(teams.name);
  for (const { personId, ...team } of rows) {
    out.set(personId, [...(out.get(personId) ?? []), team]);
  }
  return out;
}

/** The record the people capabilities are checked against. null if the person doesn't exist. */
export async function personResource(
  db: DbOrTx,
  edition: EditionRef,
  personId: string,
): Promise<PersonResource | null> {
  const [row] = await db
    .select({ id: people.id, visibility: people.directoryVisibility })
    .from(people)
    .where(and(eq(people.id, personId), isNull(people.deletedAt)));
  if (!row) return null;
  const teamList = (await teamsByPerson(db, edition, [personId])).get(personId) ?? [];
  return { personId, visibility: row.visibility, teamIds: teamList.map((t) => t.id) };
}
