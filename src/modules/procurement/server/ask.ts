"use server";
// "Ask the camp" (Oct 28 2026): a lead types a request; the app files a task with a team, owner
// and due date, puts it on the buy list when it's something to buy, and shows what it did.
// "Looks right", "Change owner" and "Change date" are saved as corrections. Every step is a new
// row in procurement_ask_log (nothing is overwritten).
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionContext,
  can,
  ForbiddenError,
  getAutomationSettings,
  moduleAction,
  ValidationError,
} from "@/base/api";
import { people, teamMemberships } from "@/base/api/schema";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { demoRouter } from "../rules/ask-demo";
import { AI_COST_CENTS_PER_ASK, aiRouterAllowed } from "../rules/ask-pick";
import type { AskRoute } from "../rules/ask-router";
import {
  procurementItems as items,
  procurementAskLog as log,
  procurementNeeds as needs,
} from "../schema";
import { aiSpentThisMonth } from "./ai-spend";
import { aiRouter } from "./ask-ai";
import { editionTeams, teamsOf } from "./queries";

const askProject = (year: number) => `Asked of the camp ${year}`;
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-01");

/** Teams this lead can file into: the ones they lead, or every team for a camp lead. */
async function askTeams(ctx: ActionContext) {
  if (ctx.actor.hasRole("camp_lead")) return editionTeams(ctx.tx, ctx.edition.id);
  const led = ctx.actor.teams
    .filter((t) => t.role === "lead" || t.role === "co_lead")
    .map((t) => t.teamId);
  return teamsOf(ctx.tx, led);
}

async function teamPeople(ctx: ActionContext, teamId: string) {
  return ctx.tx
    .select({ personId: teamMemberships.personId, role: teamMemberships.role })
    .from(teamMemberships)
    .innerJoin(people, eq(people.id, teamMemberships.personId))
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        isNull(teamMemberships.deletedAt),
        isNull(people.deletedAt),
      ),
    );
}

/** Owner: the last person a lead moved this team's asks to, else the team lead, else the asker. */
async function pickOwner(ctx: ActionContext, teamId: string) {
  const members = await teamPeople(ctx, teamId);
  const [fix] = await ctx.tx
    .select({ to: log.toValue })
    .from(log)
    .where(
      and(
        eq(log.editionId, ctx.edition.id),
        eq(log.teamId, teamId),
        eq(log.action, "change_owner"),
      ),
    )
    .orderBy(desc(log.createdAt))
    .limit(1);
  if (fix?.to && members.some((m) => m.personId === fix.to)) return fix.to;
  const lead = members.find((m) => m.role === "lead") ?? members.find((m) => m.role === "co_lead");
  return lead?.personId ?? ctx.actor.personId;
}

async function chooseRouter(ctx: ActionContext) {
  const settings = await getAutomationSettings(ctx.tx);
  const on = aiRouterAllowed({
    hasKey: !!getEnv().AI_GATEWAY_API_KEY,
    capCents: settings.ai_monthly_cap_cents ?? 0,
    spentCents: await aiSpentThisMonth(ctx.tx, ctx.now),
  });
  return on ? aiRouter([]) : demoRouter;
}

async function catalogueItem(ctx: ActionContext, name: string) {
  const rows = await ctx.tx
    .select({ id: items.id, name: items.name, unit: items.unit })
    .from(items)
    .where(and(isNull(items.deletedAt), ilike(items.name, `%${name.replace(/[%_]/g, "")}%`)))
    .limit(1);
  return rows[0] ?? null;
}

export const askTheCamp = moduleAction(
  "procurement",
  { input: z.object({ text: z.string().max(500) }), capability: "procurement.ask" },
  async (ctx, input) => {
    const text = input.text.trim().replace(/\s+/g, " ");
    if (text.length < 3)
      throw new ValidationError("Write what you need, like “20 kg of ice by Tuesday”");
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError();
    const teams = await askTeams(ctx);
    if (!teams.length) throw new ForbiddenError();
    const router = await chooseRouter(ctx);
    const route: AskRoute = await router.route({
      text,
      today: instantToCampInput(ctx.now).date,
      teams: teams.map((t) => ({ key: t.key, name: t.name })),
    });
    const team = teams.find((t) => t.key === route.teamKey) ?? teams[0];
    if (!team) throw new ForbiddenError();
    const owner = await pickOwner(ctx, team.id);
    const project = await ctx.tasks.ensureProject({
      teamKey: team.key,
      name: askProject(ctx.edition.year),
      description: "Requests filed through Ask the camp.",
    });
    const task = await ctx.tasks.create({
      projectId: project.id,
      title: route.title,
      kind: "procurement.ask",
      description: `Asked: “${text}”`,
      dueAt: route.dueOn ? campInputToInstant(route.dueOn, "12:00") : null,
      ownerPersonId: owner,
    });
    let needId: string | null = null;
    let notOnList: string | null = null;
    if (route.buy) {
      const item = await catalogueItem(ctx, route.buy.item);
      if (item) {
        const [row] = await ctx.tx
          .insert(needs)
          .values({
            editionId: ctx.edition.id,
            teamId: team.id,
            itemId: item.id,
            quantityNeeded: route.buy.quantity ?? 1,
            neededBy: route.dueOn,
            notes: `From Ask the camp: “${text}”`,
            raisedByPersonId: me,
            ownerPersonId: owner,
            taskId: task.id,
          })
          .returning({ id: needs.id });
        needId = row?.id ?? null;
      } else notOnList = route.buy.item;
    }
    const [asked] = await ctx.tx
      .insert(log)
      .values({
        editionId: ctx.edition.id,
        personId: me,
        action: "asked",
        text,
        router: router.kind === "ai" ? route.router : "demo",
        guessed: route.guessed,
        teamId: team.id,
        taskId: task.id,
        needId,
        ownerPersonId: owner,
        dueOn: route.dueOn,
        aiCostCents: route.router === "ai" ? AI_COST_CENTS_PER_ASK : 0,
        createdAt: ctx.now,
      })
      .returning({ id: log.id });
    if (!asked) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "procurement.ask.filed",
      entity: { type: "procurement.ask", id: asked.id },
      changes: { taskId: [null, task.id], teamId: [null, team.id] },
    });
    return { ok: true as const, id: asked.id, notOnList };
  },
);

async function loadAsk(ctx: ActionContext, askId: string) {
  const [row] = await ctx.tx
    .select()
    .from(log)
    .where(and(eq(log.id, askId), eq(log.editionId, ctx.edition.id), eq(log.action, "asked")));
  if (!row?.teamId || !row.taskId) throw new ForbiddenError();
  if (!can(ctx.actor, "procurement.need.manage", { teamId: row.teamId }))
    throw new ForbiddenError();
  return { ...row, teamId: row.teamId, taskId: row.taskId };
}

export const fixAsk = moduleAction(
  "procurement",
  {
    input: z.discriminatedUnion("action", [
      z.object({ askId: z.string().uuid(), action: z.literal("looks_right") }),
      z.object({
        askId: z.string().uuid(),
        action: z.literal("change_owner"),
        ownerPersonId: z.string().uuid(),
      }),
      z.object({ askId: z.string().uuid(), action: z.literal("change_date"), dueOn: dateOnly }),
    ]),
    capability: "procurement.ask",
  },
  async (ctx, input) => {
    const ask = await loadAsk(ctx, input.askId);
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError();
    let from: string | null = null;
    let to: string | null = null;
    if (input.action === "change_owner") {
      const members = await teamPeople(ctx, ask.teamId);
      if (!members.some((m) => m.personId === input.ownerPersonId))
        throw new ValidationError("Pick someone on that team");
      await ctx.tasks.setOwner(ask.taskId, input.ownerPersonId);
      if (ask.needId)
        await ctx.tx
          .update(needs)
          .set({ ownerPersonId: input.ownerPersonId, updatedAt: ctx.now })
          .where(eq(needs.id, ask.needId));
      [from, to] = [await currentOwner(ctx, ask), input.ownerPersonId];
    }
    if (input.action === "change_date") {
      await ctx.tasks.update(ask.taskId, { dueAt: campInputToInstant(input.dueOn, "12:00") });
      if (ask.needId)
        await ctx.tx
          .update(needs)
          .set({ neededBy: input.dueOn, updatedAt: ctx.now })
          .where(eq(needs.id, ask.needId));
      [from, to] = [await currentDue(ctx, ask), input.dueOn];
    }
    await ctx.tx.insert(log).values({
      editionId: ctx.edition.id,
      askId: ask.id,
      personId: me,
      action: input.action,
      teamId: ask.teamId,
      taskId: ask.taskId,
      needId: ask.needId,
      fromValue: from,
      toValue: to,
      createdAt: ctx.now,
    });
    return { ok: true as const };
  },
);

/** The owner / date as it stood before this fix: the last fix of that kind, else the ask. */
async function lastFix(ctx: ActionContext, askId: string, action: string) {
  const [row] = await ctx.tx
    .select({ to: log.toValue })
    .from(log)
    .where(and(eq(log.askId, askId), eq(log.action, action)))
    .orderBy(desc(log.createdAt))
    .limit(1);
  return row?.to ?? null;
}
const currentOwner = async (
  ctx: ActionContext,
  ask: { id: string; ownerPersonId: string | null },
) => (await lastFix(ctx, ask.id, "change_owner")) ?? ask.ownerPersonId;
const currentDue = async (ctx: ActionContext, ask: { id: string; dueOn: string | null }) =>
  (await lastFix(ctx, ask.id, "change_date")) ?? ask.dueOn;
