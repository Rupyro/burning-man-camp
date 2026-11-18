"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type ActionContext, moduleAction, ValidationError } from "@/base/api";
import {
  canWelcomeFamily,
  FAMILY_APPROVERS,
  suggestFamilyRole,
  validFamilyYears,
} from "../rules/family";
import {
  applicantFamilyAnswers as answers,
  applicantFamilyApprovals as approvals,
  applicantApplications as apps,
  applicantFamilyYears as years,
} from "../schema";
import { joinIfReady } from "./join";
import { applicationById } from "./queries";

const list = z.array(z.string().max(60)).max(12);

async function ownApplication(ctx: ActionContext) {
  const personId = ctx.actor.personId ?? "";
  await ctx.tx.insert(apps).values({ editionId: ctx.edition.id, personId }).onConflictDoNothing();
  const [row] = await ctx.tx
    .select()
    .from(apps)
    .where(and(eq(apps.editionId, ctx.edition.id), eq(apps.personId, personId)))
    .for("update");
  if (!row) throw new Error("application missing");
  return row;
}

/** A returning member sends their years and memories. The interview is skipped; an admin welcomes them in. */
export const sendFamilyJourney = moduleAction(
  "applicants",
  {
    input: z.object({
      years: z.array(z.number().int()).max(40),
      teams: list,
      led: z.boolean(),
      ledWhat: z.string().max(300).optional(),
      buildPieces: list,
      goodAt: list,
      loveTo: list,
      anythingElse: z.string().max(1000).optional(),
    }),
    capability: "applicants.apply",
  },
  async (ctx, input) => {
    const row = await ownApplication(ctx);
    if (row.status !== "draft" && row.status !== "applied")
      throw new ValidationError("Your application can't be changed any more", []);
    const ys = validFamilyYears(input.years, ctx.now);
    if (!ys.length) return { ok: false as const, error: "Light at least one year." };
    await ctx.tx.delete(years).where(eq(years.applicationId, row.id));
    await ctx.tx.insert(years).values(ys.map((year) => ({ applicationId: row.id, year })));
    const memo = {
      teams: input.teams,
      led: input.led,
      ledWhat: input.ledWhat?.trim() || null,
      buildPieces: input.buildPieces,
      goodAt: input.goodAt,
      loveTo: input.loveTo,
      anythingElse: input.anythingElse?.trim() || null,
      updatedAt: ctx.now,
    };
    await ctx.tx
      .insert(answers)
      .values({ applicationId: row.id, ...memo })
      .onConflictDoUpdate({ target: answers.applicationId, set: memo });
    const suggestion = suggestFamilyRole(input);
    await ctx.tx
      .insert(approvals)
      .values({ applicationId: row.id, suggestedRoleShown: suggestion })
      .onConflictDoUpdate({
        target: approvals.applicationId,
        set: { decision: "waiting", suggestedRoleShown: suggestion, updatedAt: ctx.now },
      });
    await ctx.tx
      .update(apps)
      .set({
        answers: { ...row.answers, family: "yes" },
        status: "applied",
        submittedAt: row.submittedAt ?? ctx.now,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(apps.id, row.id));
    await ctx.audit.record({
      action: "applicants.family.sent",
      entity: { type: "applicants.application", id: row.id },
      changes: { status: [row.status, "applied"], years: ys.join(",") },
      significance: "significant",
    });
    return { ok: true as const };
  },
);

/** Admins welcome a returning member in (skips the interview), ask a question, or decline kindly. */
export const decideFamily = moduleAction(
  "applicants",
  {
    input: z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "asked", "declined"]),
      note: z.string().max(1000).optional(),
    }),
    capability: "applicants.decide",
    resource: async (input, ctx) => {
      const row = await applicationById(ctx.db, ctx.edition.id, input.id);
      return row ? { personId: row.personId } : undefined;
    },
  },
  async (ctx, input) => {
    const a = ctx.actor;
    if (
      !canWelcomeFamily(
        { isAdmin: a.isAdmin, isLead: a.hasRole("camp_lead") || a.isAnyTeamLead },
        FAMILY_APPROVERS,
      )
    )
      return { ok: false as const, error: "Only camp admins can welcome family in." };
    const [row] = await ctx.tx
      .select()
      .from(apps)
      .where(and(eq(apps.id, input.id), eq(apps.editionId, ctx.edition.id)))
      .for("update");
    if (row?.status !== "applied")
      return { ok: false as const, error: "This one has already been decided." };
    await ctx.tx
      .update(approvals)
      .set({
        decision: input.decision,
        decidedByPersonId: a.personId,
        decidedAt: ctx.now,
        note: input.note?.trim() || null,
        updatedAt: ctx.now,
      })
      .where(eq(approvals.applicationId, row.id));
    if (input.decision === "asked") {
      await ctx.audit.record({
        action: "applicants.family.asked",
        entity: { type: "applicants.application", id: row.id },
        changes: { decision: ["waiting", "asked"] },
        significance: "activity",
      });
      return { ok: true as const, joined: false };
    }
    const status = input.decision === "approved" ? "accepted" : "declined";
    await ctx.tx
      .update(apps)
      .set({
        status,
        // Family skip the interview: there is none to wait for.
        interviewDoneAt: status === "accepted" ? ctx.now : row.interviewDoneAt,
        decidedAt: ctx.now,
        decidedByPersonId: a.personId,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(apps.id, row.id));
    if (status === "accepted")
      await ctx.tx
        .update(years)
        .set({ leadConfirmed: true })
        .where(eq(years.applicationId, row.id));
    await ctx.audit.record({
      action: "applicants.family.decided",
      entity: { type: "applicants.application", id: row.id },
      changes: { status: [row.status, status] },
      significance: "significant",
    });
    if (status === "accepted")
      await ctx.events.emit("applicants.application.accepted", {
        v: 1,
        applicationId: row.id,
        personId: row.personId,
        editionId: ctx.edition.id,
      });
    return { ok: true as const, joined: status === "accepted" && (await joinIfReady(ctx, row.id)) };
  },
);
