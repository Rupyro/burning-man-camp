import "server-only";
// The kit daily job (rule 14) and the handovers it shows in a lead's Up next.
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getAutomationSettings, type JobFn, type ModuleContext } from "@/base/api";
import { people, teamMemberships, teams } from "@/base/api/schema";
import { campInputToInstant } from "@/lib/dates";
import { buyDeadlineAlerts, kitAutomations } from "../rules/automations";
import { procurementItems, procurementNeeds } from "../schema";

const n = procurementNeeds;
/** Open needs someone still has to pick up. */
const OPEN = ["needed", "to_buy", "to_borrow"] as const;

export async function collectKitAutomations(ctx: ModuleContext) {
  const rows = await ctx.db
    .select({
      needId: n.id,
      itemName: procurementItems.name,
      teamId: n.teamId,
      teamName: teams.name,
      raisedAt: n.createdAt,
      neededBy: n.neededBy,
    })
    .from(n)
    .innerJoin(procurementItems, eq(procurementItems.id, n.itemId))
    .innerJoin(teams, eq(teams.id, n.teamId))
    .where(and(eq(n.editionId, ctx.edition.id), inArray(n.status, OPEN), isNull(n.ownerPersonId)));
  if (!rows.length) return { reminders: [], handovers: [] };
  const leads = await ctx.db
    .select({ teamId: teamMemberships.teamId, id: teamMemberships.personId })
    .from(teamMemberships)
    .where(
      and(
        inArray(
          teamMemberships.teamId,
          rows.map((r) => r.teamId),
        ),
        inArray(teamMemberships.role, ["lead", "co_lead"]),
        isNull(teamMemberships.deletedAt),
      ),
    );
  return kitAutomations(
    rows.map((r) => ({
      ...r,
      neededBy: r.neededBy ? campInputToInstant(r.neededBy, "12:00") : null,
      leadIds: leads.filter((l) => l.teamId === r.teamId).map((l) => l.id),
    })),
    ctx.now,
  );
}

/** Rule 2: every open need with a needed-by date, claimed or not, for the buy-list warning. */
export async function collectBuyDeadlines(ctx: ModuleContext) {
  const days = (await getAutomationSettings(ctx.db)).buy_alert_days ?? 5;
  const rows = await ctx.db
    .select({
      needId: n.id,
      itemName: procurementItems.name,
      teamId: n.teamId,
      teamName: teams.name,
      neededBy: n.neededBy,
      ownerName: people.displayName,
    })
    .from(n)
    .innerJoin(procurementItems, eq(procurementItems.id, n.itemId))
    .innerJoin(teams, eq(teams.id, n.teamId))
    .leftJoin(people, eq(people.id, n.ownerPersonId))
    .where(and(eq(n.editionId, ctx.edition.id), inArray(n.status, OPEN), isNotNull(n.neededBy)));
  return buyDeadlineAlerts(
    rows.map((r) => ({
      ...r,
      neededBy: r.neededBy ? campInputToInstant(r.neededBy, "12:00") : null,
    })),
    ctx.now,
    days,
  );
}

const job: JobFn = async (ctx) => {
  const kit = await collectKitAutomations(ctx);
  return { ...kit, handovers: [...kit.handovers, ...(await collectBuyDeadlines(ctx))] };
};
export default job;
