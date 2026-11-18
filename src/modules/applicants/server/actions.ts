"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type ActionContext, moduleAction, ValidationError } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { validateAnswers } from "../rules/form";
import { checkLeadMove, DOC_KEYS, LEAD_STATUSES } from "../rules/journey";
import { applicantApplications as apps, applicantDocuments as docs } from "../schema";
import { joinIfReady } from "./join";
import { applicationById } from "./queries";

/** Answers may change until a lead decides (spec §3). */
const EDITABLE = new Set(["draft", "applied", "interview_scheduled"]);

/** The caller's application, created as a draft the first time (locked for this transaction). */
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

/** Save the PLACEHOLDER form as a draft, or send it (every required answer needed). */
export const saveApplication = moduleAction(
  "applicants",
  {
    input: z.object({ answers: z.record(z.string(), z.string().max(2000)), submit: z.boolean() }),
    capability: "applicants.apply",
  },
  async (ctx, input) => {
    const row = await ownApplication(ctx);
    if (!EDITABLE.has(row.status))
      throw new ValidationError("Your application can't be changed any more", []);
    const { answers, errors } = validateAnswers(input.answers, input.submit);
    if (Object.keys(errors).length) return { ok: false as const, errors };
    const sending = input.submit && row.status === "draft";
    await ctx.tx
      .update(apps)
      .set({
        answers,
        ...(sending ? { status: "applied" as const, submittedAt: ctx.now } : {}),
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(apps.id, row.id));
    await ctx.audit.record({
      action: sending ? "applicants.application.submitted" : "applicants.application.saved",
      entity: { type: "applicants.application", id: row.id },
      changes: sending ? { status: [row.status, "applied"] } : { answers: "[redacted]" },
      significance: sending ? "significant" : "activity",
    });
    return { ok: true as const, sent: sending || row.status !== "draft" };
  },
);

/** Confirm one required document (read-and-confirm placeholders, spec §3). */
export const confirmDocument = moduleAction(
  "applicants",
  {
    input: z.object({ docKey: z.string().refine((k) => DOC_KEYS.includes(k), "Unknown document") }),
    capability: "applicants.apply",
  },
  async (ctx, { docKey }) => {
    const row = await ownApplication(ctx);
    if (row.status === "declined" || row.status === "joined")
      throw new ValidationError("Your application can't be changed any more", []);
    const added = await ctx.tx
      .insert(docs)
      .values({ applicationId: row.id, docKey, doneAt: ctx.now })
      .onConflictDoNothing()
      .returning({ id: docs.id });
    if (added.length)
      await ctx.audit.record({
        action: "applicants.document.confirmed",
        entity: { type: "applicants.application", id: row.id },
        changes: { docKey: [null, docKey] },
      });
    return { joined: await joinIfReady(ctx, row.id) };
  },
);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-01-20");
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 18:30");

/** A lead updates status, interview date (camp time) or the private note (spec §4). */
export const updateApplication = moduleAction(
  "applicants",
  {
    input: z.object({
      id: z.string().uuid(),
      status: z.enum(LEAD_STATUSES).optional(),
      interviewDate: dateOnly.optional(),
      interviewTime: timeOnly.optional(),
      note: z.string().max(2000).nullable().optional(),
    }),
    capability: "applicants.decide",
    resource: async (input, ctx) => {
      const row = await applicationById(ctx.db, ctx.edition.id, input.id);
      return row ? { personId: row.personId } : undefined;
    },
  },
  async (ctx, input) => {
    const [row] = await ctx.tx
      .select()
      .from(apps)
      .where(and(eq(apps.id, input.id), eq(apps.editionId, ctx.edition.id)))
      .for("update");
    if (!row) throw new ValidationError("Application not found", []);
    const set: Partial<typeof apps.$inferInsert> = {};
    const changes: Record<string, [unknown, unknown]> = {};
    if (input.status) {
      const interviewAt =
        input.interviewDate && input.interviewTime
          ? campInputToInstant(input.interviewDate, input.interviewTime)
          : null;
      const why = checkLeadMove(row.status, input.status, interviewAt);
      if (why) return { changed: false, joined: false, error: why };
      set.status = input.status;
      changes.status = [row.status, input.status];
      if (input.status === "interview_scheduled") {
        set.interviewAt = interviewAt;
        changes.interviewAt = [row.interviewAt?.toISOString() ?? null, interviewAt?.toISOString()];
      }
      if (input.status === "accepted") set.interviewDoneAt = row.interviewDoneAt ?? ctx.now;
      if (input.status === "accepted" || input.status === "declined") {
        set.decidedAt = ctx.now;
        set.decidedByPersonId = ctx.actor.personId;
      }
      if (input.status === "applied") {
        set.decidedAt = null;
        set.decidedByPersonId = null;
      }
    }
    if (input.note !== undefined && (input.note?.trim() || null) !== row.leadNote) {
      set.leadNote = input.note?.trim() || null;
      changes.leadNote = ["[redacted]", "[redacted]"];
    }
    if (!Object.keys(set).length) return { changed: false, joined: false, error: null };
    await ctx.tx
      .update(apps)
      .set({ ...set, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(apps.id, row.id));
    await ctx.audit.record({
      action: "applicants.application.updated",
      entity: { type: "applicants.application", id: row.id },
      changes,
      significance: input.status ? "significant" : "activity",
    });
    if (input.status === "accepted")
      await ctx.events.emit("applicants.application.accepted", {
        v: 1,
        applicationId: row.id,
        personId: row.personId,
        editionId: ctx.edition.id,
      });
    return { changed: true, joined: await joinIfReady(ctx, row.id), error: null };
  },
);

/** Welcome list: the new member has read the camp guide. Ticking it again changes nothing. */
export const markGuideRead = moduleAction(
  "applicants",
  { input: z.object({}), capability: "applicants.welcome" },
  async (ctx) => {
    const [row] = await ctx.tx
      .select()
      .from(apps)
      .where(and(eq(apps.editionId, ctx.edition.id), eq(apps.personId, ctx.actor.personId ?? "")));
    if (!row) throw new ValidationError("There's no welcome list for you", []);
    if (row.guideReadAt) return { ok: true as const };
    await ctx.tx
      .update(apps)
      .set({ guideReadAt: ctx.now, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(apps.id, row.id));
    await ctx.audit.record({
      action: "applicants.guide.read",
      entity: { type: "applicants.application", id: row.id },
      changes: { guideReadAt: [null, ctx.now.toISOString()] },
      significance: "activity",
    });
    return { ok: true as const };
  },
);
