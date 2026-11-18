import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import { ForbiddenError } from "../errors";
import { projectKindEnum, projects, seasonPhaseEnum, teams } from "../schema";
import { type EngineCtx, inTx, loadProject, parse } from "./shared";

const projectInput = z.strictObject({
  teamId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(projectKindEnum.enumValues).optional(),
  phase: z.enum(seasonPhaseEnum.enumValues).nullable().optional(),
  parentProjectId: z.string().uuid().nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

/** Spec T1: project.manage on the owning team. The creator becomes the project lead. */
export async function createProject(ctx: EngineCtx, raw: z.input<typeof projectInput>) {
  const input = parse(projectInput, raw);
  if (!can(ctx.actor, "project.manage", { teamId: input.teamId })) throw new ForbiddenError();
  return inTx(ctx.db, async (tx) => {
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, input.teamId), eq(teams.editionId, ctx.edition.id)));
    if (!team) throw new ForbiddenError();
    if (input.parentProjectId) {
      const parent = await loadProject(tx, ctx.edition, input.parentProjectId);
      if (parent.teamId !== input.teamId) throw new ForbiddenError();
    }
    const [p] = await tx
      .insert(projects)
      .values({ ...input, editionId: ctx.edition.id, leadPersonId: ctx.actor.personId })
      .returning({ id: projects.id });
    if (!p) throw new Error("project insert returned nothing");
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "project.created",
        entity: { type: "base.project", id: p.id },
        changes: { name: [null, input.name], teamId: [null, input.teamId] },
      },
    );
    return p;
  });
}

/** Every live project this edition with its team name (task.view). */
export async function listProjects(ctx: EngineCtx) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  return ctx.db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      teamId: projects.teamId,
      teamName: teams.name,
      parentProjectId: projects.parentProjectId,
    })
    .from(projects)
    .innerJoin(teams, eq(teams.id, projects.teamId))
    .where(and(eq(projects.editionId, ctx.edition.id), isNull(projects.deletedAt)))
    .orderBy(asc(teams.name), asc(projects.name));
}

/** Spec S2: one project with its team, and what the caller may do there (re-checked by each action). */
export async function getProject(ctx: EngineCtx, projectId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  const p = await loadProject(ctx.db, ctx.edition, projectId);
  const [team] = await ctx.db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, p.teamId));
  const r = { teamId: p.teamId };
  return {
    ...p,
    teamName: team?.name ?? "",
    can: { plan: can(ctx.actor, "project.manage", r), addTask: can(ctx.actor, "task.create", r) },
  };
}

/** Teams in this edition the caller may start a project for. */
export async function listPlannableTeams(ctx: EngineCtx) {
  const rows = await ctx.db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.editionId, ctx.edition.id), isNull(teams.deletedAt)))
    .orderBy(asc(teams.name));
  return rows.filter((t) => can(ctx.actor, "project.manage", { teamId: t.id }));
}
