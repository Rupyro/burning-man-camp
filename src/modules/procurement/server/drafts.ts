"use server";
// Drafts (Oct 28 2026): a lead asks for a vendor email or WhatsApp update, the app writes a draft,
// and the lead edits, discards or sends it. Email goes through the camp email outbox; WhatsApp is
// only ever a link the lead opens. Every step adds a row to procurement_draft_log.
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionContext,
  can,
  enqueueEmail,
  ForbiddenError,
  getAutomationSettings,
  moduleAction,
  ValidationError,
} from "@/base/api";
import { CAMP_NAME } from "@/lib/camp";
import { getEnv } from "@/lib/env";
import { aiRouterAllowed } from "../rules/ask-pick";
import { AI_COST_CENTS_PER_DRAFT, demoWriter, whatsappLink } from "../rules/draft-writer";
import { procurementDraftLog as dlog, procurementDrafts as drafts } from "../schema";
import { aiSpentThisMonth } from "./ai-spend";
import { aiWriter } from "./draft-ai";
import { editionTeams, teamsOf } from "./queries";

const emailOk = z.string().email();

async function myTeams(ctx: ActionContext) {
  if (ctx.actor.hasRole("camp_lead")) return editionTeams(ctx.tx, ctx.edition.id);
  const led = ctx.actor.teams
    .filter((t) => t.role === "lead" || t.role === "co_lead")
    .map((t) => t.teamId);
  return teamsOf(ctx.tx, led);
}

async function chooseWriter(ctx: ActionContext) {
  const settings = await getAutomationSettings(ctx.tx);
  const on = aiRouterAllowed({
    hasKey: !!getEnv().AI_GATEWAY_API_KEY,
    capCents: settings.ai_monthly_cap_cents ?? 0,
    spentCents: (await aiSpentThisMonth(ctx.tx, ctx.now)) + AI_COST_CENTS_PER_DRAFT,
  });
  return on ? aiWriter : demoWriter;
}

async function logStep(ctx: ActionContext, draftId: string, action: string) {
  const me = ctx.actor.personId;
  if (!me) throw new ForbiddenError();
  await ctx.tx.insert(dlog).values({ draftId, personId: me, action, createdAt: ctx.now });
}

export const makeDraft = moduleAction(
  "procurement",
  {
    input: z.object({
      kind: z.enum(["email", "whatsapp"]),
      to: z.string().max(200),
      ask: z.string().max(1000),
      teamId: z.string().uuid().optional(),
    }),
    capability: "procurement.draft",
  },
  async (ctx, input) => {
    const ask = input.ask.trim();
    const to = input.to.trim();
    if (ask.length < 3) throw new ValidationError("Write what the message should say");
    if (!to) throw new ValidationError("Say who it's for");
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError();
    const teams = await myTeams(ctx);
    const team = input.teamId ? teams.find((t) => t.id === input.teamId) : teams[0];
    if (!team) throw new ForbiddenError();
    const names = await ctx.people.displayNames([me]);
    const writer = await chooseWriter(ctx);
    const d = await writer.write({
      kind: input.kind,
      ask,
      to,
      senderName: names.get(me) ?? "The team",
      teamName: team.name,
    });
    const [row] = await ctx.tx
      .insert(drafts)
      .values({
        editionId: ctx.edition.id,
        personId: me,
        teamId: team.id,
        kind: input.kind,
        ask,
        toText: to,
        subject: d.subject,
        body: d.body,
        writer: d.writer,
        aiCostCents: d.writer === "ai" ? AI_COST_CENTS_PER_DRAFT : 0,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      })
      .returning({ id: drafts.id });
    if (!row) throw new ValidationError("Could not save");
    await logStep(ctx, row.id, "drafted");
    return { ok: true as const, id: row.id };
  },
);

/** The writer, a lead of the draft's team, or a camp lead; and only while it's still a draft. */
async function loadOpenDraft(ctx: ActionContext, id: string) {
  const [d] = await ctx.tx.select().from(drafts).where(eq(drafts.id, id));
  if (!d || d.editionId !== ctx.edition.id) throw new ForbiddenError();
  const mine = d.personId === ctx.actor.personId;
  if (!mine && !can(ctx.actor, "procurement.need.manage", { teamId: d.teamId }))
    throw new ForbiddenError();
  if (d.status !== "draft") throw new ValidationError(`This draft was already ${d.status}`);
  return d;
}

const setStatus = (ctx: ActionContext, id: string, status: "sent" | "discarded") =>
  ctx.tx.update(drafts).set({ status, updatedAt: ctx.now }).where(eq(drafts.id, id));

const idInput = z.object({ id: z.string().uuid() });

export const editDraft = moduleAction(
  "procurement",
  {
    input: z.object({
      id: z.string().uuid(),
      to: z.string().min(1).max(200),
      subject: z.string().max(200).optional(),
      body: z.string().min(1).max(5000),
    }),
    capability: "procurement.draft",
  },
  async (ctx, input) => {
    const d = await loadOpenDraft(ctx, input.id);
    await ctx.tx
      .update(drafts)
      .set({
        toText: input.to.trim(),
        subject: d.kind === "email" ? (input.subject?.trim() ?? d.subject) : null,
        body: input.body,
        updatedAt: ctx.now,
      })
      .where(eq(drafts.id, d.id));
    await logStep(ctx, d.id, "edited");
    return { ok: true as const };
  },
);

export const discardDraft = moduleAction(
  "procurement",
  { input: idInput, capability: "procurement.draft" },
  async (ctx, input) => {
    const d = await loadOpenDraft(ctx, input.id);
    await setStatus(ctx, d.id, "discarded");
    await logStep(ctx, d.id, "discarded");
    return { ok: true as const };
  },
);

/** Email only: queues it in the camp outbox (console only until a real email account exists). */
export const sendDraft = moduleAction(
  "procurement",
  { input: idInput, capability: "procurement.draft" },
  async (ctx, input) => {
    const d = await loadOpenDraft(ctx, input.id);
    if (d.kind !== "email") throw new ValidationError("Use Open in WhatsApp for WhatsApp drafts");
    if (!emailOk.safeParse(d.toText).success)
      throw new ValidationError("Put a real email address in To before sending");
    await enqueueEmail(ctx.tx, {
      toPersonId: null,
      toEmail: d.toText,
      template: "procurement.draft",
      payload: { subject: d.subject ?? `Message from ${CAMP_NAME}`, text: d.body },
      dedupeKey: `procurement.draft:${d.id}`,
    });
    await setStatus(ctx, d.id, "sent");
    await logStep(ctx, d.id, "sent");
    return { ok: true as const };
  },
);

/** WhatsApp: the lead taps "Open in WhatsApp" and sends it there. The app only logs the tap. */
export const markWhatsappOpened = moduleAction(
  "procurement",
  { input: idInput, capability: "procurement.draft" },
  async (ctx, input) => {
    const d = await loadOpenDraft(ctx, input.id);
    if (d.kind !== "whatsapp") throw new ValidationError("This draft is an email");
    await setStatus(ctx, d.id, "sent");
    await logStep(ctx, d.id, "opened_whatsapp");
    return { ok: true as const, link: whatsappLink(d.body) };
  },
);
