// `ctx.tasks` for modules (MODULE_RULEBOOK.md §6): the base engine, bound to one transaction and
// actor. Permissions, audit rows and notifications are the engine's own; nothing is bypassed.
import { and, eq, isNull } from "drizzle-orm";
import type { ModuleTasksApi } from "../registry/types";
import { projects, teams } from "../schema";
import { createProject } from "./projects";
import type { EngineCtx } from "./shared";
import { createTask, setTaskOwner, updateTask } from "./tasks";

export function createModuleTasksApi(ctx: EngineCtx): ModuleTasksApi {
  return {
    async ensureProject({ teamKey, name, kind, description }) {
      const [team] = await ctx.db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.editionId, ctx.edition.id), eq(teams.key, teamKey)));
      if (!team) throw new Error(`No team "${teamKey}" in this edition`);
      const [existing] = await ctx.db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.editionId, ctx.edition.id),
            eq(projects.teamId, team.id),
            eq(projects.name, name),
            isNull(projects.deletedAt),
          ),
        );
      if (existing) return { id: existing.id, teamId: team.id };
      const p = await createProject(ctx, {
        teamId: team.id,
        name,
        kind: kind ?? "general",
        description: description ?? null,
      });
      return { id: p.id, teamId: team.id };
    },
    create: (input) => createTask(ctx, input),
    update: (taskId, patch) => updateTask(ctx, taskId, patch),
    setOwner: (taskId, owner) => setTaskOwner(ctx, taskId, owner),
  };
}
