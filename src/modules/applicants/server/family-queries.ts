import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { ActionContext, ModuleContext } from "@/base/api";
import { people } from "@/base/api/schema";
import {
  applicantFamilyAnswers as answers,
  applicantFamilyApprovals as approvals,
  applicantApplications as apps,
  applicantFamilyYears as years,
} from "../schema";

type Reader = ModuleContext["db"] | ActionContext["tx"];

export interface FamilyCard {
  applicationId: string;
  personId: string;
  name: string;
  status: string;
  decision: string;
  years: number[];
  suggestion: string | null;
  memo: typeof answers.$inferSelect | null;
}

async function cards(db: Reader, appIds: string[]): Promise<FamilyCard[]> {
  if (!appIds.length) return [];
  const rows = await db
    .select({ app: apps, name: people.displayName, ap: approvals })
    .from(approvals)
    .innerJoin(apps, eq(apps.id, approvals.applicationId))
    .innerJoin(people, eq(people.id, apps.personId))
    .where(inArray(approvals.applicationId, appIds));
  const ys = await db.select().from(years).where(inArray(years.applicationId, appIds));
  const ms = await db.select().from(answers).where(inArray(answers.applicationId, appIds));
  return rows.map(
    (r: { app: typeof apps.$inferSelect; name: string; ap: typeof approvals.$inferSelect }) => ({
      applicationId: r.app.id,
      personId: r.app.personId,
      name: r.name,
      status: r.app.status,
      decision: r.ap.decision,
      years: ys
        .filter((y) => y.applicationId === r.app.id)
        .map((y) => y.year)
        .sort((a, b) => a - b),
      suggestion: r.ap.suggestedRoleShown,
      memo: ms.find((m) => m.applicationId === r.app.id) ?? null,
    }),
  );
}

/** Returning family waiting to be welcomed in this edition. */
export async function familyWaiting(db: Reader, editionId: string): Promise<FamilyCard[]> {
  const rows = await db
    .select({ id: apps.id })
    .from(approvals)
    .innerJoin(apps, eq(apps.id, approvals.applicationId))
    .where(and(eq(apps.editionId, editionId), inArray(approvals.decision, ["waiting", "asked"])));
  return cards(
    db,
    rows.map((r) => r.id),
  );
}

export async function familyByApplication(db: Reader, appId: string): Promise<FamilyCard | null> {
  return (await cards(db, [appId]))[0] ?? null;
}

/** A person's family years (any edition), for the profile card and years badges. */
export async function familyFor(db: Reader, personId: string) {
  const rows = await db
    .select({ year: years.year, confirmed: years.leadConfirmed, status: apps.status })
    .from(years)
    .innerJoin(apps, eq(apps.id, years.applicationId))
    .where(eq(apps.personId, personId));
  const all = [...new Set(rows.map((r: { year: number }) => r.year))].sort() as number[];
  const confirmed = [
    ...new Set(
      rows.filter((r: { confirmed: boolean }) => r.confirmed).map((r: { year: number }) => r.year),
    ),
  ].sort() as number[];
  return { years: all, confirmed };
}
