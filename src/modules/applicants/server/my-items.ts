import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  can,
  getAutomationSettings,
  handoverItems,
  type MyItem,
  type MyItemsProvider,
} from "@/base/api";
import { people } from "@/base/api/schema";
import { formatCampTime } from "@/lib/dates";
import { welcomeOpen } from "../rules/welcome";
import { applicantApplications as apps } from "../schema";
import { collectApplicantAutomations } from "./automations";

const WEEK = 7 * 86_400_000;

/** Welcome list (rule 6): one home row for a new member until they've read the camp guide. */
const welcomeItem: (ctx: Parameters<MyItemsProvider>[0]) => Promise<MyItem[]> = async (ctx) => {
  if (!ctx.actor.personId || !can(ctx.actor, "applicants.welcome")) return [];
  const [row] = await ctx.db
    .select({ joinedAt: apps.joinedAt, paidAt: apps.paidAt, guideReadAt: apps.guideReadAt })
    .from(apps)
    .where(and(eq(apps.editionId, ctx.edition.id), eq(apps.personId, ctx.actor.personId)));
  if (!row) return [];
  const on = (await getAutomationSettings(ctx.db)).welcome_todos === 1;
  if (!welcomeOpen(row, ctx.now, on)) return [];
  return [
    {
      id: `applicants:welcome:${ctx.edition.id}`,
      moduleId: "applicants",
      kind: "other",
      title: "Welcome to the camp! Three things to do first",
      urgency: "soon",
      href: "/apply/welcome",
    },
  ];
};

/**
 * New members get the welcome row. Reviewers also get (spec §4): one row for new applications waiting for a lead, one per interview
 * in the next 7 days, and the automations' handovers (rules 1–3) meant for this person.
 * Applicants never see the home page, so they get nothing here.
 */
export const myApplicantItems: MyItemsProvider = async (ctx) => {
  const items: MyItem[] = await welcomeItem(ctx);
  if (!can(ctx.actor, "applicants.review")) return items;
  const [waiting] = await ctx.db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(apps)
    .where(and(eq(apps.editionId, ctx.edition.id), eq(apps.status, "applied")));
  if (waiting?.n)
    items.push({
      id: "applicants:waiting",
      moduleId: "applicants",
      kind: "approval",
      title: `${waiting.n} new application${waiting.n === 1 ? "" : "s"} to review`,
      urgency: "soon",
      href: "/apply/review?stage=applied",
    });
  const soon = await ctx.db
    .select({ id: apps.id, at: apps.interviewAt, name: people.displayName })
    .from(apps)
    .innerJoin(people, eq(people.id, apps.personId))
    .where(
      and(
        eq(apps.editionId, ctx.edition.id),
        eq(apps.status, "interview_scheduled"),
        gte(apps.interviewAt, ctx.now),
        lte(apps.interviewAt, new Date(ctx.now.getTime() + WEEK)),
      ),
    );
  for (const s of soon)
    if (s.at)
      items.push({
        id: `applicants:${s.id}:interview`,
        moduleId: "applicants",
        kind: "deadline",
        title: `Interview ${s.name}, ${formatCampTime(s.at, "EEE d MMM, HH:mm")}`,
        dueAt: s.at,
        urgency: "normal",
        href: `/apply/review/${s.id}`,
      });
  const { handovers } = await collectApplicantAutomations(ctx);
  return [...items, ...handoverItems("applicants", ctx.actor, handovers)];
};
