import "server-only";
// Reads for the "Ask the camp" page: my recent asks, what the app did, and who could own them.
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { people, teamMemberships, teams } from "@/base/api/schema";
import { procurementAskLog as log } from "../schema";

export async function myRecentAsks(ctx: ModuleContext, limit = 5) {
  const me = ctx.actor.personId;
  if (!me) return [];
  const asks = await ctx.db
    .select({
      id: log.id,
      text: log.text,
      router: log.router,
      guessed: log.guessed,
      teamId: log.teamId,
      teamName: teams.name,
      taskId: log.taskId,
      needId: log.needId,
      ownerPersonId: log.ownerPersonId,
      dueOn: log.dueOn,
      createdAt: log.createdAt,
    })
    .from(log)
    .leftJoin(teams, eq(teams.id, log.teamId))
    .where(and(eq(log.editionId, ctx.edition.id), eq(log.personId, me), eq(log.action, "asked")))
    .orderBy(desc(log.createdAt))
    .limit(limit);
  if (!asks.length) return [];
  const fixes = await ctx.db
    .select({ askId: log.askId, action: log.action, to: log.toValue })
    .from(log)
    .where(
      inArray(
        log.askId,
        asks.map((a) => a.id),
      ),
    )
    .orderBy(log.createdAt);
  const teamIds = [...new Set(asks.map((a) => a.teamId).filter((x): x is string => !!x))];
  const members = await ctx.db
    .select({ teamId: teamMemberships.teamId, id: people.id, name: people.displayName })
    .from(teamMemberships)
    .innerJoin(people, eq(people.id, teamMemberships.personId))
    .where(
      and(
        inArray(teamMemberships.teamId, teamIds),
        isNull(teamMemberships.deletedAt),
        isNull(people.deletedAt),
      ),
    );
  return asks.map((a) => {
    const mine = fixes.filter((f) => f.askId === a.id);
    const last = (k: string) => mine.filter((f) => f.action === k).at(-1)?.to ?? null;
    const ownerId = last("change_owner") ?? a.ownerPersonId;
    const team = members.filter((m) => m.teamId === a.teamId);
    return {
      ...a,
      ownerId,
      ownerName: team.find((m) => m.id === ownerId)?.name ?? "you",
      dueOn: last("change_date") ?? a.dueOn,
      confirmed: mine.some((f) => f.action === "looks_right"),
      fixed: mine.some((f) => f.action !== "looks_right"),
      team: team.map((m) => ({ id: m.id, name: m.name })),
    };
  });
}
