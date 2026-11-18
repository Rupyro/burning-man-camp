import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ActionContext, ModuleContext } from "@/base/api";
import { people } from "@/base/api/schema";
import type { ApplicationStatus, JourneyFacts } from "../rules/journey";
import { applicantApplications as apps, applicantDocuments as docs } from "../schema";

type Reader = ModuleContext["db"] | ActionContext["tx"];
export type ApplicationRow = typeof apps.$inferSelect;
export type Application = ApplicationRow & { docsDone: string[] };

export const facts = (a: Application): JourneyFacts => a;

async function withDocs(db: Reader, rows: ApplicationRow[]): Promise<Application[]> {
  if (!rows.length) return [];
  const done = await db
    .select({ applicationId: docs.applicationId, docKey: docs.docKey })
    .from(docs)
    .where(
      inArray(
        docs.applicationId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((r) => ({
    ...r,
    docsDone: done.filter((d) => d.applicationId === r.id).map((d) => d.docKey),
  }));
}

/** The caller's own application in this edition (null = not started). */
export async function myApplication(db: Reader, editionId: string, personId: string) {
  const rows = await db
    .select()
    .from(apps)
    .where(and(eq(apps.editionId, editionId), eq(apps.personId, personId)));
  return (await withDocs(db, rows))[0] ?? null;
}

/** One application in this edition, with the applicant's display name (reviewers only). */
export async function applicationById(db: Reader, editionId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db
    .select({ app: apps, name: people.displayName, playa: people.playaName })
    .from(apps)
    .innerJoin(people, eq(people.id, apps.personId))
    .where(and(eq(apps.id, id), eq(apps.editionId, editionId)));
  const row = rows[0];
  if (!row) return null;
  const [full] = await withDocs(db, [row.app]);
  return full ? { ...full, name: row.name, playa: row.playa } : null;
}

/** Order of the Open applications list: what needs a lead first. */
const STAGE_ORDER: ApplicationStatus[] = [
  "applied",
  "interview_scheduled",
  "accepted",
  "draft",
  "declined",
  "joined",
];

/** Open applications for this edition (reviewers only), optionally one stage. */
export async function listApplications(db: Reader, editionId: string, stage?: ApplicationStatus) {
  const where = [eq(apps.editionId, editionId)];
  if (stage) where.push(eq(apps.status, stage));
  const rows = await db
    .select({ app: apps, name: people.displayName })
    .from(apps)
    .innerJoin(people, eq(people.id, apps.personId))
    .where(and(...where))
    .orderBy(asc(apps.interviewAt), asc(apps.submittedAt), asc(people.displayName));
  const full = await withDocs(
    db,
    rows.map((r) => r.app),
  );
  const names = new Map(rows.map((r) => [r.app.id, r.name]));
  return full
    .map((a) => ({ ...a, name: names.get(a.id) ?? "" }))
    .sort((x, y) => STAGE_ORDER.indexOf(x.status) - STAGE_ORDER.indexOf(y.status));
}

/** How many applications sit in each stage (for the list header). */
export async function stageCounts(db: Reader, editionId: string) {
  const rows = await db
    .select({ status: apps.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(apps)
    .where(eq(apps.editionId, editionId))
    .groupBy(apps.status);
  return new Map(rows.map((r) => [r.status, r.n]));
}

/** Applied and accepted applications with names and documents (the automations' facts). */
export async function openApplications(db: Reader, editionId: string) {
  const rows = await db
    .select({ app: apps, name: people.displayName })
    .from(apps)
    .innerJoin(people, eq(people.id, apps.personId))
    .where(and(eq(apps.editionId, editionId), inArray(apps.status, ["applied", "accepted"])));
  const withNames = await withDocs(
    db,
    rows.map((r) => r.app),
  );
  return withNames.map((a) => ({ ...a, name: rows.find((r) => r.app.id === a.id)?.name ?? "" }));
}
