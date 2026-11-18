// Team notices (Oct 28 2026, option C): a lead posts a short message to their own team with an
// end time. Members see it as a banner until it ends or they tap "Got it". The lead (and admins)
// see who has read it, also after it ends.
import { and, asc, desc, eq, gt, inArray, isNull, ne, notExists } from "drizzle-orm";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { type EngineCtx, nowOf } from "../engine/shared";
import { ForbiddenError, ValidationError } from "../errors";
import { people, teamMemberships, teamNoticeReads, teamNotices, teams } from "../schema";

const MAX_DAYS = 60;
const LEAD_ROLES = ["lead", "co_lead"] as const;

const live = (personId: string) =>
  and(eq(teamMemberships.personId, personId), isNull(teamMemberships.deletedAt));

/** Notices showing for this person right now: their teams, not ended, not "Got it", not theirs. */
export async function activeNoticesFor(db: DbOrTx, personId: string, now: Date) {
  return db
    .select({
      id: teamNotices.id,
      body: teamNotices.body,
      endsAt: teamNotices.endsAt,
      teamName: teams.name,
      authorName: people.displayName,
    })
    .from(teamNotices)
    .innerJoin(teams, eq(teams.id, teamNotices.teamId))
    .innerJoin(teamMemberships, eq(teamMemberships.teamId, teamNotices.teamId))
    .innerJoin(people, eq(people.id, teamNotices.authorPersonId))
    .where(
      and(
        live(personId),
        isNull(teams.deletedAt),
        isNull(teamNotices.deletedAt),
        gt(teamNotices.endsAt, now),
        ne(teamNotices.authorPersonId, personId),
        notExists(
          db
            .select({ id: teamNoticeReads.id })
            .from(teamNoticeReads)
            .where(
              and(
                eq(teamNoticeReads.noticeId, teamNotices.id),
                eq(teamNoticeReads.personId, personId),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(teamNotices.endsAt));
}

/** Teams this person may post to: the ones they lead, or every team for an admin. */
async function teamsILead(ctx: EngineCtx) {
  const all = can(ctx.actor, "team.manage");
  const personId = ctx.actor.personId;
  if (!all && !personId) return [];
  const rows = all
    ? await ctx.db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(and(eq(teams.editionId, ctx.edition.id), isNull(teams.deletedAt)))
    : await ctx.db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .innerJoin(teamMemberships, eq(teamMemberships.teamId, teams.id))
        .where(
          and(
            eq(teams.editionId, ctx.edition.id),
            isNull(teams.deletedAt),
            live(personId ?? ""),
            inArray(teamMemberships.role, [...LEAD_ROLES]),
          ),
        );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function postNotice(
  ctx: EngineCtx,
  input: { teamId: string; body: string; endsAt: Date },
): Promise<string> {
  const now = nowOf(ctx);
  if (!ctx.actor.personId) throw new ForbiddenError();
  if (!(await teamsILead(ctx)).some((t) => t.id === input.teamId)) throw new ForbiddenError();
  const body = input.body.trim();
  if (!body) throw new ValidationError("Write what the notice says");
  if (body.length > 280) throw new ValidationError("Keep it under 280 characters");
  if (input.endsAt.getTime() <= now.getTime())
    throw new ValidationError("Pick an end time that's still to come");
  if (input.endsAt.getTime() > now.getTime() + MAX_DAYS * 86_400_000)
    throw new ValidationError(`Pick an end time within ${MAX_DAYS} days`);
  const row = firstRow(
    await ctx.db
      .insert(teamNotices)
      .values({
        teamId: input.teamId,
        authorPersonId: ctx.actor.personId,
        body,
        endsAt: input.endsAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: teamNotices.id }),
  );
  await recordAudit(
    ctx.db,
    { actor: ctx.actor, editionId: ctx.edition.id },
    {
      action: "team.notice_posted",
      entity: { type: "base.team_notice", id: row.id },
      changes: { teamId: [null, input.teamId] },
    },
  );
  return row.id;
}

/** End now: a lead of that team (or an admin) takes the banner down early. The read list stays. */
export async function endNoticeNow(ctx: EngineCtx, noticeId: string) {
  const now = nowOf(ctx);
  const [notice] = await ctx.db
    .select({ teamId: teamNotices.teamId, endsAt: teamNotices.endsAt })
    .from(teamNotices)
    .where(and(eq(teamNotices.id, noticeId), isNull(teamNotices.deletedAt)));
  if (!notice || !(await teamsILead(ctx)).some((t) => t.id === notice.teamId))
    throw new ForbiddenError();
  if (notice.endsAt.getTime() <= now.getTime())
    throw new ValidationError("This notice has already ended");
  await ctx.db
    .update(teamNotices)
    .set({ endsAt: now, updatedAt: now })
    .where(eq(teamNotices.id, noticeId));
  await recordAudit(
    ctx.db,
    { actor: ctx.actor, editionId: ctx.edition.id },
    {
      action: "team.notice_ended",
      entity: { type: "base.team_notice", id: noticeId },
      changes: { endsAt: [notice.endsAt.toISOString(), now.toISOString()] },
    },
  );
  return { ended: true };
}

/** "Got it": only someone on that notice's team. Tapping twice is fine. */
export async function markNoticeRead(ctx: EngineCtx, noticeId: string) {
  const personId = ctx.actor.personId;
  if (!personId) throw new ForbiddenError();
  const [mine] = await ctx.db
    .select({ id: teamNotices.id })
    .from(teamNotices)
    .innerJoin(teamMemberships, eq(teamMemberships.teamId, teamNotices.teamId))
    .where(and(eq(teamNotices.id, noticeId), isNull(teamNotices.deletedAt), live(personId)));
  if (!mine) throw new ForbiddenError();
  await ctx.db
    .insert(teamNoticeReads)
    .values({ noticeId, personId, readAt: nowOf(ctx) })
    .onConflictDoNothing();
  return { read: true };
}

/** For the teams I lead: recent notices (newest first) with each team member's "Got it" time. */
export async function noticesForLead(ctx: EngineCtx, limit = 10) {
  const now = nowOf(ctx);
  const led = await teamsILead(ctx);
  return Promise.all(
    led.map(async (team) => {
      const [notices, members] = await Promise.all([
        ctx.db
          .select({
            id: teamNotices.id,
            body: teamNotices.body,
            endsAt: teamNotices.endsAt,
            createdAt: teamNotices.createdAt,
            authorPersonId: teamNotices.authorPersonId,
            authorName: people.displayName,
          })
          .from(teamNotices)
          .innerJoin(people, eq(people.id, teamNotices.authorPersonId))
          .where(and(eq(teamNotices.teamId, team.id), isNull(teamNotices.deletedAt)))
          .orderBy(desc(teamNotices.createdAt))
          .limit(limit),
        ctx.db
          .select({ personId: people.id, name: people.displayName })
          .from(teamMemberships)
          .innerJoin(people, eq(people.id, teamMemberships.personId))
          .where(
            and(
              eq(teamMemberships.teamId, team.id),
              isNull(teamMemberships.deletedAt),
              isNull(people.deletedAt),
            ),
          )
          .orderBy(asc(people.displayName)),
      ]);
      const reads = notices.length
        ? await ctx.db
            .select()
            .from(teamNoticeReads)
            .where(
              inArray(
                teamNoticeReads.noticeId,
                notices.map((n) => n.id),
              ),
            )
        : [];
      return {
        ...team,
        notices: notices.map((n) => ({
          id: n.id,
          body: n.body,
          endsAt: n.endsAt,
          createdAt: n.createdAt,
          authorName: n.authorName,
          ended: n.endsAt.getTime() <= now.getTime(),
          readers: members
            .filter((m) => m.personId !== n.authorPersonId)
            .map((m) => ({
              name: m.name,
              readAt:
                reads.find((r) => r.noticeId === n.id && r.personId === m.personId)?.readAt ?? null,
            })),
        })),
      };
    }),
  );
}
