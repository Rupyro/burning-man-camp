import "server-only";
// Admin daily review: yesterday's asks and drafts, the fixes leads made, anything worth a look,
// and the AI spend against the monthly limit. Camp admins only (procurement.review).
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { can, getAutomationSettings, type ModuleContext } from "@/base/api";
import { teams } from "@/base/api/schema";
import { isStaleDraft, yesterdayOf } from "../rules/review";
import { procurementDrafts as drafts, procurementAskLog as log } from "../schema";
import { aiSpentThisMonth } from "./ai-spend";

export type ReviewFlag =
  | { kind: "moved"; text: string }
  | { kind: "guessed"; text: string }
  | { kind: "stale_draft"; text: string; days: number };

export async function dailyReview(ctx: ModuleContext) {
  const y = yesterdayOf(ctx.now);
  const inDay = (col: typeof log.createdAt | typeof drafts.createdAt) =>
    and(gte(col, y.start), lt(col, y.end));
  const asks = await ctx.db
    .select({
      id: log.id,
      text: log.text,
      router: log.router,
      guessed: log.guessed,
      teamName: teams.name,
    })
    .from(log)
    .leftJoin(teams, eq(teams.id, log.teamId))
    .where(and(eq(log.editionId, ctx.edition.id), eq(log.action, "asked"), inDay(log.createdAt)))
    .orderBy(log.createdAt);
  const fixes = await ctx.db
    .select({ id: log.id, askId: log.askId, action: log.action, teamName: teams.name })
    .from(log)
    .leftJoin(teams, eq(teams.id, log.teamId))
    .where(and(eq(log.editionId, ctx.edition.id), ne(log.action, "asked"), inDay(log.createdAt)))
    .orderBy(log.createdAt);
  const made = await ctx.db
    .select()
    .from(drafts)
    .where(and(eq(drafts.editionId, ctx.edition.id), inDay(drafts.createdAt)))
    .orderBy(drafts.createdAt);
  const open = await ctx.db
    .select()
    .from(drafts)
    .where(and(eq(drafts.editionId, ctx.edition.id), eq(drafts.status, "draft")));
  const askText = new Map(asks.map((a) => [a.id, a.text ?? ""]));
  const flags: ReviewFlag[] = [];
  for (const f of fixes)
    if (f.action === "change_owner")
      flags.push({
        kind: "moved",
        text: `“${askText.get(f.askId ?? "") ?? "An ask"}” (${f.teamName ?? "a team"}) was given to someone else by a lead.`,
      });
  for (const a of asks)
    if (a.guessed)
      flags.push({ kind: "guessed", text: `“${a.text}” matched no team word, so it was a guess.` });
  for (const d of open)
    if (isStaleDraft(d, ctx.now)) {
      const days = Math.floor((ctx.now.getTime() - d.createdAt.getTime()) / 86_400_000);
      flags.push({
        kind: "stale_draft",
        days,
        text: `The ${d.kind === "email" ? "email" : "WhatsApp"} draft “${d.subject ?? d.ask}” has been a draft for ${days} days and hasn't been sent.`,
      });
    }
  const settings = await getAutomationSettings(ctx.db);
  return {
    date: y.date,
    asks,
    fixes,
    drafts: made,
    flags,
    spentCents: await aiSpentThisMonth(ctx.db, ctx.now),
    capCents: settings.ai_monthly_cap_cents ?? 0,
    allowed: can(ctx.actor, "procurement.review"),
  };
}
