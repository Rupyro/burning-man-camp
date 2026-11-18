import "server-only";
// The applicants daily job (rules 1–3) and the handovers it shows in a lead's Up next.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getAutomationSettings, type JobFn, type ModuleContext } from "@/base/api";
import { roleAssignments, roles, teamMemberships, teams } from "@/base/api/schema";
import {
  applicantAutomations,
  FEE_LEAD_DAYS_DEFAULT,
  FEE_REMINDER_DAYS_DEFAULT,
} from "../rules/automations";
import { openApplications } from "./queries";

/** Who reviews applications: camp leads and team leads (permissions.ts "reviewer"). */
async function reviewerIds(db: ModuleContext["db"], editionId: string) {
  const [camp, leads] = await Promise.all([
    db
      .select({ id: roleAssignments.personId })
      .from(roleAssignments)
      .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
      .where(and(eq(roles.key, "camp_lead"), isNull(roleAssignments.deletedAt))),
    db
      .select({ id: teamMemberships.personId })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(
        and(
          eq(teams.editionId, editionId),
          inArray(teamMemberships.role, ["lead", "co_lead"]),
          isNull(teamMemberships.deletedAt),
        ),
      ),
  ]);
  return [...new Set([...camp, ...leads].map((r) => r.id))];
}

/** Each person's team this year (members only), so fee news goes to their own team lead. */
async function teamOf(db: ModuleContext["db"], editionId: string) {
  const rows = await db
    .select({ personId: teamMemberships.personId, teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(
      and(
        eq(teams.editionId, editionId),
        eq(teamMemberships.role, "member"),
        isNull(teamMemberships.deletedAt),
      ),
    );
  return new Map(rows.map((r) => [r.personId, r.teamId]));
}

export async function collectApplicantAutomations(ctx: ModuleContext) {
  const [apps, reviewers, teamByPerson, settings] = await Promise.all([
    openApplications(ctx.db, ctx.edition.id),
    reviewerIds(ctx.db, ctx.edition.id),
    teamOf(ctx.db, ctx.edition.id),
    getAutomationSettings(ctx.db),
  ]);
  return applicantAutomations(
    apps.map((a) => ({ ...a, teamId: teamByPerson.get(a.personId) ?? null })),
    ctx.now,
    reviewers,
    {
      reminderDays: settings.fee_reminder_days ?? FEE_REMINDER_DAYS_DEFAULT,
      leadDays: settings.fee_lead_days ?? FEE_LEAD_DAYS_DEFAULT,
    },
  );
}

const job: JobFn = (ctx) => collectApplicantAutomations(ctx);
export default job;
