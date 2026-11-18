import "server-only";
// The AfrikaBurn deadlines daily job (rule 15): reminders to the owner and the owning team leads.
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { JobFn } from "@/base/api";
import { teamMemberships, teams } from "@/base/api/schema";
import { deadlineReminders } from "../rules/automations";
import { obligationDocuments } from "../schema";
import { OBLIGATIONS_TEAM } from "./create";
import { listObligations } from "./queries";

const job: JobFn = async (ctx) => {
  const open = (await listObligations(ctx.db, ctx.edition.id)).filter(
    (o) => o.dueAt && o.status !== "done" && o.status !== "cancelled",
  );
  if (!open.length) return { reminders: [] };
  const [docs, leads] = await Promise.all([
    ctx.db
      .select({ taskId: obligationDocuments.taskId, name: obligationDocuments.name })
      .from(obligationDocuments)
      .where(
        and(
          inArray(
            obligationDocuments.taskId,
            open.map((o) => o.taskId),
          ),
          eq(obligationDocuments.status, "needed"),
        ),
      )
      .orderBy(obligationDocuments.position),
    ctx.db
      .select({ id: teamMemberships.personId })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(
        and(
          eq(teams.editionId, ctx.edition.id),
          eq(teams.key, OBLIGATIONS_TEAM),
          inArray(teamMemberships.role, ["lead", "co_lead"]),
          isNull(teamMemberships.deletedAt),
        ),
      ),
  ]);
  const deadlines = open.flatMap((o) =>
    o.dueAt
      ? [
          {
            taskId: o.taskId,
            title: o.title,
            dueAt: o.dueAt,
            ownerPersonId: o.ownerPersonId,
            missingDocuments: docs.filter((d) => d.taskId === o.taskId).map((d) => d.name),
          },
        ]
      : [],
  );
  return {
    reminders: deadlineReminders(
      deadlines,
      leads.map((l) => l.id),
      ctx.now,
    ),
  };
};
export default job;
