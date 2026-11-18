import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { type EditionRef, getCurrentEdition } from "../editions/current";
import type { RoleKey } from "../registry/types";
import { editionMembers, people, roleAssignments, roles, teamMemberships, teams } from "../schema";

export interface ResolvedActor {
  actor: Actor;
  edition: EditionRef;
}

/** Build the Actor for a person in an edition: status, roles (live) and team memberships. */
export async function loadActorForPerson(
  db: DbOrTx,
  personId: string,
  edition: EditionRef,
  now = new Date(),
): Promise<Actor | null> {
  const [person] = await db
    .select({ id: people.id, displayName: people.displayName })
    .from(people)
    .where(and(eq(people.id, personId), isNull(people.deletedAt)));
  if (!person) return null;

  const [membership] = await db
    .select({ status: editionMembers.status })
    .from(editionMembers)
    .where(
      and(
        eq(editionMembers.personId, personId),
        eq(editionMembers.editionId, edition.id),
        isNull(editionMembers.deletedAt),
      ),
    );

  const roleRows = await db
    .select({ key: roles.key })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(
      and(
        eq(roleAssignments.personId, personId),
        isNull(roleAssignments.deletedAt),
        or(isNull(roleAssignments.editionId), eq(roleAssignments.editionId, edition.id)),
        or(isNull(roleAssignments.endsAt), gt(roleAssignments.endsAt, now)),
      ),
    );

  const teamRows = await db
    .select({ teamId: teams.id, teamKey: teams.key, role: teamMemberships.role })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(
      and(
        eq(teamMemberships.personId, personId),
        eq(teams.editionId, edition.id),
        isNull(teamMemberships.deletedAt),
        isNull(teams.deletedAt),
      ),
    );

  return new Actor({
    kind: "person",
    personId: person.id,
    displayName: person.displayName,
    editionId: edition.id,
    memberStatus: membership?.status ?? null,
    roles: [...new Set(roleRows.map((r) => r.key as RoleKey))],
    teams: teamRows,
  });
}

/** Session user → person → actor in the current edition. null if the login has no person. */
export async function loadActorForUser(db: DbOrTx, userId: string): Promise<ResolvedActor | null> {
  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.userId, userId), isNull(people.deletedAt)));
  if (!person) return null;
  const edition = await getCurrentEdition(db);
  if (!edition) return null;
  const actor = await loadActorForPerson(db, person.id, edition);
  return actor ? { actor, edition } : null;
}
