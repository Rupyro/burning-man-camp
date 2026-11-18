import { and, asc, eq, isNull } from "drizzle-orm";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { ForbiddenError, ValidationError } from "../errors";
import type { PeopleCtx } from "../people/directory";
import { people, teamMemberships, teams } from "../schema";

export type TeamRole = "lead" | "co_lead" | "member";
const RANK: Record<TeamRole, number> = { lead: 0, co_lead: 1, member: 2 };

const inTx = <T>(db: DbOrTx, fn: (tx: DbOrTx) => Promise<T>) =>
  "transaction" in db ? db.transaction(fn) : fn(db);

/** Teams this edition with their people, leads first (spec P1: visible to confirmed members). */
export async function listTeams(ctx: PeopleCtx) {
  if (!can(ctx.actor, "member.view_directory")) throw new ForbiddenError();
  const teamRows = await ctx.db
    .select()
    .from(teams)
    .where(and(eq(teams.editionId, ctx.edition.id), isNull(teams.deletedAt)))
    .orderBy(asc(teams.name));
  const memberRows = await ctx.db
    .select({
      teamId: teamMemberships.teamId,
      personId: people.id,
      displayName: people.displayName,
      role: teamMemberships.role,
    })
    .from(teamMemberships)
    .innerJoin(people, eq(people.id, teamMemberships.personId))
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(
      and(
        eq(teams.editionId, ctx.edition.id),
        isNull(teamMemberships.deletedAt),
        isNull(people.deletedAt),
      ),
    )
    .orderBy(asc(people.displayName));
  return teamRows.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    parentTeamId: t.parentTeamId,
    whatsappInviteUrl: t.whatsappInviteUrl,
    members: memberRows
      .filter((m) => m.teamId === t.id)
      .sort((a, b) => RANK[a.role] - RANK[b.role])
      .map(({ teamId: _t, ...m }) => m),
  }));
}

async function teamInEdition(db: DbOrTx, editionId: string, teamId: string) {
  const [t] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.editionId, editionId), isNull(teams.deletedAt)));
  if (!t) throw new ForbiddenError();
  return t;
}

/** Create a team (team.manage). Keys are unique per edition. */
export async function createTeam(
  ctx: PeopleCtx,
  input: { key: string; name: string; description?: string; parentTeamId?: string },
): Promise<string> {
  if (!can(ctx.actor, "team.manage")) throw new ForbiddenError();
  const key = input.key.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) throw new ValidationError("Team key: a-z, 0-9, _");
  if (!input.name.trim()) throw new ValidationError("A team needs a name");
  return inTx(ctx.db, async (tx) => {
    const [clash] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.editionId, ctx.edition.id), eq(teams.key, key)));
    if (clash) throw new ValidationError(`Team "${key}" already exists`);
    if (input.parentTeamId) await teamInEdition(tx, ctx.edition.id, input.parentTeamId);
    const row = firstRow(
      await tx
        .insert(teams)
        .values({
          editionId: ctx.edition.id,
          key,
          name: input.name.trim(),
          description: input.description ?? null,
          parentTeamId: input.parentTeamId ?? null,
        })
        .returning({ id: teams.id }),
    );
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "team.created",
        entity: { type: "base.team", id: row.id },
        changes: { key: [null, key] },
        significance: "significant",
      },
    );
    return row.id;
  });
}

async function currentMembership(db: DbOrTx, teamId: string, personId: string) {
  const [m] = await db
    .select()
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.personId, personId)));
  return m ?? null;
}

/** The higher of two roles: changing someone from/to lead needs the power to appoint a lead. */
const higher = (a: TeamRole | null, b: TeamRole): TeamRole =>
  a !== null && RANK[a] < RANK[b] ? a : b;

/** Add someone to a team or change their team role (spec P7). */
export async function setTeamMember(
  ctx: PeopleCtx,
  input: { teamId: string; personId: string; role: TeamRole },
) {
  await teamInEdition(ctx.db, ctx.edition.id, input.teamId);
  return inTx(ctx.db, async (tx) => {
    const existing = await currentMembership(tx, input.teamId, input.personId);
    const live = existing && !existing.deletedAt ? existing : null;
    const role = higher(live?.role ?? null, input.role);
    if (!can(ctx.actor, "team.manage_members", { teamId: input.teamId, role }))
      throw new ForbiddenError();
    const [person] = await tx
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, input.personId), isNull(people.deletedAt)));
    if (!person) throw new ValidationError("No such person");
    if (live?.role === input.role) return { changed: false };
    if (existing) {
      await tx
        .update(teamMemberships)
        .set({ role: input.role, deletedAt: null, updatedAt: ctx.now ?? new Date() })
        .where(eq(teamMemberships.id, existing.id));
    } else {
      await tx.insert(teamMemberships).values(input);
    }
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      live
        ? {
            action: "team.member_role_changed",
            entity: { type: "base.person", id: input.personId },
            changes: { role: [live.role, input.role] },
            significance: "significant",
          }
        : {
            action: "team.member_added",
            entity: { type: "base.person", id: input.personId },
            changes: { teamId: [null, input.teamId], role: [null, input.role] },
            significance: "significant",
          },
    );
    return { changed: true };
  });
}

/** Take someone off a team (soft delete). Removing a lead needs team.manage. */
export async function removeTeamMember(
  ctx: PeopleCtx,
  input: { teamId: string; personId: string },
) {
  await teamInEdition(ctx.db, ctx.edition.id, input.teamId);
  return inTx(ctx.db, async (tx) => {
    const existing = await currentMembership(tx, input.teamId, input.personId);
    const role = existing && !existing.deletedAt ? existing.role : "member";
    if (!can(ctx.actor, "team.manage_members", { teamId: input.teamId, role }))
      throw new ForbiddenError();
    if (!existing || existing.deletedAt) return { changed: false };
    const now = ctx.now ?? new Date();
    await tx
      .update(teamMemberships)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(teamMemberships.id, existing.id));
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "team.member_removed",
        entity: { type: "base.person", id: input.personId },
        changes: { teamId: [input.teamId, null], role: [existing.role, null] },
        significance: "significant",
      },
    );
    return { changed: true };
  });
}
