// Fake, deterministic, idempotent applications (docs/specs/applicants.md §8). Writes only
// applicant tables; the people are the base seed's fake prospects, waitlisted and confirmed
// members (example.test emails), plus the demo Applicant persona when it exists.
import { and, asc, eq, inArray, like } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { editionMembers, people } from "@/base/api/schema";
import { campConfig } from "@/lib/camp";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";
import { suggestFamilyRole } from "./rules/family";
import type { Answers } from "./rules/form";
import { type ApplicationStatus, DOC_KEYS } from "./rules/journey";
import {
  applicantFamilyAnswers,
  applicantFamilyApprovals,
  applicantFamilyYears,
  applicantApplications as apps,
  applicantDocuments as docs,
} from "./schema";

const DAY = 86_400_000;
const WHY = [
  "Friends camped with you in 2026 and came home glowing. I want to help build the shade and cook.",
  "I love the art car idea and I'm handy with lights. I'd like to be part of a crew, not a tourist.",
  "First burn! I want a camp where everyone pitches in, and yours sounds like that.",
  "I've done three burns with smaller camps and want to give back with build and strike.",
];
const HELP = [
  "Build and carpentry",
  "Kitchen shifts",
  "Art car crew and lights",
  "MOOP and strike",
];

function answers(i: number, full: boolean): Answers {
  const a: Answers = { country: ["South Africa", "Germany", "Netherlands", "France"][i % 4] ?? "" };
  if (!full) return { ...a, why: WHY[i % WHY.length] ?? "" };
  return {
    ...a,
    burns: ["First burn", "1–2 burns", "3 or more"][i % 3] ?? "",
    why: WHY[i % WHY.length] ?? "",
    contribute: HELP[i % HELP.length] ?? "",
    build_strike: ["Build", "Strike", "Both", "Neither"][i % 4] ?? "",
    heard_from: "A friend in the camp (demo)",
  };
}

/** Interview time: `days` from now at 18:30 camp time. */
function interview(now: Date, days: number) {
  return campInputToInstant(instantToCampInput(new Date(now.getTime() + days * DAY)).date, "18:30");
}

type Plan = { status: ApplicationStatus; days?: number; docs?: number };

async function peopleWith(
  db: ModuleSeedContext["db"],
  editionId: string,
  status: "prospect" | "waitlisted" | "confirmed",
  n: number,
) {
  const rows = await db
    .select({ id: people.id })
    .from(editionMembers)
    .innerJoin(people, eq(people.id, editionMembers.personId))
    .where(
      and(
        eq(editionMembers.editionId, editionId),
        eq(editionMembers.status, status),
        like(people.email, "%.%@example.test"),
      ),
    )
    .orderBy(asc(people.email))
    .limit(n);
  return rows.map((r) => r.id);
}

export async function seed(ctx: ModuleSeedContext) {
  const { db, edition } = ctx;
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * DAY);
  const [prospects, waitlisted, confirmed] = await Promise.all([
    peopleWith(db, edition.id, "prospect", 8),
    peopleWith(db, edition.id, "waitlisted", 3),
    peopleWith(db, edition.id, "confirmed", 3),
  ]);
  const plans: [string, Plan][] = [
    ...prospects.map((id, i): [string, Plan] => [
      id,
      i < 2
        ? { status: "draft" }
        : i < 5
          ? { status: "applied" }
          : { status: "interview_scheduled", days: [2, 5, 12][i - 5] ?? 5 },
    ]),
    ...waitlisted.map((id, i): [string, Plan] => [
      id,
      i < 2 ? { status: "accepted", docs: i === 1 ? DOC_KEYS.length : 1 } : { status: "declined" },
    ]),
    ...confirmed.map((id): [string, Plan] => [id, { status: "joined", docs: DOC_KEYS.length }]),
  ];

  for (const [i, [personId, plan]] of plans.entries()) {
    const sent = plan.status !== "draft";
    const decided = ["accepted", "declined", "joined"].includes(plan.status);
    const met = plan.status === "accepted" || plan.status === "joined";
    const [row] = await db
      .insert(apps)
      .values({
        editionId: edition.id,
        personId,
        status: plan.status,
        answers: answers(i, sent),
        submittedAt: sent ? ago(30 - i) : null,
        interviewAt: plan.days
          ? interview(now, plan.days)
          : met || plan.status === "declined"
            ? ago(10)
            : null,
        interviewDoneAt: met ? ago(10) : null,
        decidedAt: decided ? ago(8) : null,
        decidedByPersonId: decided ? ctx.people.lead : null,
        feeCents: plan.status === "joined" ? 350_000 : null,
        feeCurrency: plan.status === "joined" ? campConfig.money.currency : null,
        paidAt: plan.status === "joined" ? ago(5) : null,
        joinedAt: plan.status === "joined" ? ago(5) : null,
      })
      .onConflictDoNothing()
      .returning({ id: apps.id });
    if (!row) continue; // already seeded
    if (plan.docs)
      await db
        .insert(docs)
        .values(
          DOC_KEYS.slice(0, plan.docs).map((docKey) => ({
            applicationId: row.id,
            docKey,
            doneAt: ago(6),
          })),
        )
        .onConflictDoNothing();
    // Accepted applicants owe the camp fee: Finance answers through the event bus.
    if (plan.status === "accepted")
      await ctx.events?.emit("applicants.application.accepted", {
        v: 1,
        applicationId: row.id,
        personId,
        editionId: edition.id,
      });
  }

  await seedNewApplicant(ctx, now);
  await seedFamily(ctx, [
    { personId: prospects[2], years: [2024, 2025, 2026], decision: "waiting" },
    { personId: prospects[3], years: [2023, 2024, 2025, 2026], decision: "waiting" },
    { personId: confirmed[0], years: [2023, 2024, 2025, 2026], decision: "approved" },
  ]);

  // The demo Member persona joined three days ago, so their home shows the welcome list.
  const [joined] = await db
    .insert(apps)
    .values({
      editionId: edition.id,
      personId: ctx.people.member,
      status: "joined",
      answers: answers(2, true),
      submittedAt: ago(20),
      interviewAt: ago(10),
      interviewDoneAt: ago(10),
      decidedAt: ago(8),
      decidedByPersonId: ctx.people.lead,
      feeCents: 350_000,
      feeCurrency: campConfig.money.currency,
      paidAt: ago(3),
      joinedAt: ago(3),
    })
    .onConflictDoNothing()
    .returning({ id: apps.id });
  if (joined)
    await db
      .insert(docs)
      .values(DOC_KEYS.map((docKey) => ({ applicationId: joined.id, docKey, doneAt: ago(9) })))
      .onConflictDoNothing();
  // The demo Member is Oe-aa-sies Family too: three confirmed years (2 and 3 years badges).
  await seedFamily(ctx, [
    { personId: ctx.people.member, years: [2024, 2025, 2026], decision: "approved" },
  ]);

  // The demo Applicant persona: reset to "interview booked, one document done" on every seed.
  const kai = ctx.people.applicant;
  if (!kai) return;
  const persona = {
    status: "interview_scheduled" as const,
    answers: { ...answers(1, true), playa_name: "Kai (demo)" },
    submittedAt: ago(4),
    interviewAt: interview(now, 3),
    interviewDoneAt: null,
    decidedAt: null,
    decidedByPersonId: null,
    feeCents: null,
    feeCurrency: null,
    feeRefType: null,
    feeRefId: null,
    paidAt: null,
    joinedAt: null,
    leadNote: null,
    updatedAt: now,
  };
  const [mine] = await db
    .insert(apps)
    .values({ editionId: edition.id, personId: kai, ...persona })
    .onConflictDoUpdate({ target: [apps.editionId, apps.personId], set: persona })
    .returning({ id: apps.id });
  if (!mine) return;
  await db.delete(docs).where(inArray(docs.applicationId, [mine.id]));
  await db.insert(docs).values({ applicationId: mine.id, docKey: "principles", doneAt: ago(3) });
}

/** The demo New applicant persona: reset to "form sent today, nothing else yet" on every seed. */
async function seedNewApplicant({ db, edition, people: demo }: ModuleSeedContext, now: Date) {
  const nia = demo.new_applicant;
  if (!nia) return;
  const persona = {
    status: "applied" as const,
    answers: { ...answers(2, true), playa_name: "Nia (demo)" },
    submittedAt: now,
    interviewAt: null,
    interviewDoneAt: null,
    decidedAt: null,
    decidedByPersonId: null,
    feeCents: null,
    feeCurrency: null,
    feeRefType: null,
    feeRefId: null,
    paidAt: null,
    joinedAt: null,
    leadNote: null,
    updatedAt: now,
  };
  const [mine] = await db
    .insert(apps)
    .values({ editionId: edition.id, personId: nia, ...persona })
    .onConflictDoUpdate({ target: [apps.editionId, apps.personId], set: persona })
    .returning({ id: apps.id });
  if (mine) await db.delete(docs).where(eq(docs.applicationId, mine.id));
}

/** Oe-aa-sies Family demo: two returning members waiting to be welcomed, one already welcomed. */
async function seedFamily(
  ctx: ModuleSeedContext,
  plans: { personId: string | undefined; years: number[]; decision: "waiting" | "approved" }[],
) {
  const { db, edition } = ctx;
  for (const [i, p] of plans.entries()) {
    if (!p.personId) continue;
    const [app] = await db
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.editionId, edition.id), eq(apps.personId, p.personId)));
    if (!app) continue;
    const memo = {
      teams: i === 1 ? ["Transport", "MOOP"] : ["Build", "Art", "Kitchen"],
      led: i !== 1,
      ledWhat: i !== 1 ? "Co-led the Cloud build in 2025 (demo)" : null,
      buildPieces: i === 1 ? ["Ossewas"] : ["Cloud", "Protea lanterns"],
      goodAt: i === 1 ? ["Driving big vehicles"] : ["Lights & wiring", "Sorting people out"],
      loveTo: i === 1 ? ["Same as before"] : ["Leading a team"],
    };
    await db
      .insert(applicantFamilyYears)
      .values(
        p.years.map((year) => ({
          applicationId: app.id,
          year,
          leadConfirmed: p.decision === "approved",
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(applicantFamilyAnswers)
      .values({ applicationId: app.id, ...memo })
      .onConflictDoNothing();
    await db
      .insert(applicantFamilyApprovals)
      .values({
        applicationId: app.id,
        decision: p.decision,
        suggestedRoleShown: suggestFamilyRole(memo),
        decidedByPersonId: p.decision === "approved" ? ctx.people.admin : null,
        decidedAt: p.decision === "approved" ? new Date() : null,
      })
      .onConflictDoNothing();
  }
}
