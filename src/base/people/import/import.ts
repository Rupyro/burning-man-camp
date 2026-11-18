import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../../audit/audit";
import { can } from "../../authz/permissions";
import type { DbOrTx } from "../../db/client";
import { ForbiddenError, ValidationError } from "../../errors";
import { editionMembers, people } from "../../schema";
import type { PeopleCtx } from "../directory";
import { capacityStatus } from "../members";
import { parseCsv } from "./csv";
import { guessMapping, type ImportField, type Mapping, normaliseRow } from "./mapping";

// Dry run, then apply (spec I2–I8). Idempotent on email; name matches are flagged, never merged.

export type Resolution = "create" | "skip" | { link: string };
export interface ImportInput {
  csv: string;
  fileName: string;
  /** Stamp new people with this import batch (stage d), so the batch can be undone. */
  importBatchId?: string;
  mapping?: Mapping;
  /** By CSV line number, for rows reported as "duplicate". */
  resolutions?: Record<number, Resolution>;
}
export type RowAction = "create" | "update" | "unchanged" | "duplicate" | "error";
export interface ReportRow {
  line: number;
  email: string | null;
  displayName: string | null;
  action: RowAction;
  /** Field names that would change (no values: the report may be shared). */
  changes: string[];
  issues: string[];
  candidates?: { personId: string; displayName: string; email: string }[];
}
export interface ImportReport {
  headers: string[];
  mapping: Mapping;
  rows: ReportRow[];
  counts: Record<RowAction, number>;
  warnings: string[];
}

const PERSON_KEYS = [
  "legalFirstName",
  "legalLastName",
  "playaName",
  "phoneE164",
  "countryCode",
] as const;
const MEMBER_KEYS = [
  "status",
  "paymentStatus",
  "arrivalAt",
  "departureAt",
  "buildCommitment",
  "strikeCommitment",
  "tentChoice",
  "diet",
  "allergies",
] as const;
const FIELD_NAME: Record<string, string> = {
  phoneE164: "phone",
  legalFirstName: "firstName",
  legalLastName: "lastName",
};
const sameValue = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? (a as Date | null)?.getTime?.() === (b as Date | null)?.getTime?.()
    : a === b;
const nameKey = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

interface Planned {
  row: ReportRow;
  values: ReturnType<typeof normaliseRow>["values"];
  targetPersonId: string | null;
  personSet: Record<string, unknown>;
  memberSet: Record<string, unknown>;
  hasMember: boolean;
}

async function plan(db: DbOrTx, ctx: PeopleCtx, input: ImportInput) {
  const table = (() => {
    try {
      return parseCsv(input.csv);
    } catch (e) {
      throw new ValidationError(e instanceof Error ? e.message : "Unreadable CSV");
    }
  })();
  const [headers = [], ...body] = table;
  if (body.length > 2000) throw new ValidationError("At most 2000 rows per import");
  const mapping = input.mapping ?? guessMapping(headers);
  if (mapping.length !== headers.length)
    throw new ValidationError("Mapping doesn't match the columns");
  if (!mapping.includes("email")) throw new ValidationError("Map one column to the email column");

  const parsed = body.map((cells, i) => {
    const raw: Partial<Record<ImportField, string>> = {};
    mapping.forEach((f, c) => {
      if (f) raw[f] = cells[c] ?? "";
    });
    return { line: i + 2, ...normaliseRow(raw) };
  });
  const emails = parsed.flatMap((p) => (p.values.email ? [p.values.email] : []));
  const existing = emails.length
    ? await db
        .select()
        .from(people)
        .where(and(inArray(sql`lower(${people.email})`, emails), isNull(people.deletedAt)))
    : [];
  const byEmail = new Map(existing.map((p) => [p.email.toLowerCase(), p]));
  const everyone = await db
    .select({
      id: people.id,
      displayName: people.displayName,
      email: people.email,
      first: people.legalFirstName,
      last: people.legalLastName,
    })
    .from(people)
    .where(isNull(people.deletedAt));
  const ids = [
    ...new Set([
      ...existing.map((p) => p.id),
      ...Object.values(input.resolutions ?? {}).flatMap((r) =>
        typeof r === "object" ? [r.link] : [],
      ),
    ]),
  ];
  const members = ids.length
    ? await db
        .select()
        .from(editionMembers)
        .where(
          and(
            eq(editionMembers.editionId, ctx.edition.id),
            inArray(editionMembers.personId, ids),
            isNull(editionMembers.deletedAt),
          ),
        )
    : [];
  const memberOf = new Map(members.map((m) => [m.personId, m]));

  const seenEmail = new Map<string, number>();
  const seenName = new Map<string, number>();
  const planned: Planned[] = [];
  for (const p of parsed) {
    const v = p.values;
    const row: ReportRow = {
      line: p.line,
      email: v.email ?? null,
      displayName: v.displayName ?? null,
      action: "error",
      changes: [],
      issues: [...p.issues],
    };
    const item: Planned = {
      row,
      values: v,
      targetPersonId: null,
      personSet: {},
      memberSet: {},
      hasMember: false,
    };
    planned.push(item);
    if (v.email && seenEmail.has(v.email))
      row.issues.push(`email appears earlier in the file (line ${seenEmail.get(v.email)})`);
    if (v.email && !seenEmail.has(v.email)) seenEmail.set(v.email, p.line);
    if (row.issues.length || !v.email) continue;

    let person = byEmail.get(v.email) ?? null;
    if (!person) {
      const key = nameKey(v.displayName);
      const candidates = everyone.filter(
        (e) =>
          key &&
          (nameKey(e.displayName) === key || nameKey(`${e.first ?? ""} ${e.last ?? ""}`) === key),
      );
      const inFile = key ? seenName.get(key) : undefined;
      if (key && inFile === undefined) seenName.set(key, p.line);
      const resolution = input.resolutions?.[p.line];
      if ((candidates.length || inFile !== undefined) && resolution !== "create") {
        if (resolution && typeof resolution === "object") {
          person = everyone.some((e) => e.id === resolution.link)
            ? firstRow(await db.select().from(people).where(eq(people.id, resolution.link)))
            : null;
          if (!person) {
            row.issues.push("the person chosen for this row doesn't exist");
            continue;
          }
        } else {
          row.action = "duplicate";
          row.candidates = candidates.map((c) => ({
            personId: c.id,
            displayName: c.displayName,
            email: c.email,
          }));
          if (inFile !== undefined) row.issues.push(`same name as line ${inFile}`);
          continue;
        }
      }
    }
    const member = person ? memberOf.get(person.id) : undefined;
    for (const k of PERSON_KEYS) {
      if (v[k] === undefined) continue;
      if (person && sameValue(person[k], v[k])) continue;
      item.personSet[k] = v[k];
      if (person) row.changes.push(FIELD_NAME[k] ?? k);
    }
    for (const k of MEMBER_KEYS) {
      if (v[k] === undefined) continue;
      if (member && sameValue(member[k], v[k])) continue;
      item.memberSet[k] = v[k];
      if (member) row.changes.push(FIELD_NAME[k] ?? k);
    }
    item.hasMember = Boolean(member);
    item.targetPersonId = person?.id ?? null;
    if (!person) row.action = "create";
    else if (!member) {
      row.action = "update";
      row.changes.push("member record");
    } else row.action = row.changes.length ? "update" : "unchanged";
  }

  const counts: Record<RowAction, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    duplicate: 0,
    error: 0,
  };
  for (const p of planned) counts[p.row.action]++;
  const warnings: string[] = [];
  const { confirmed, capacity } = await capacityStatus(db, ctx.edition.id);
  const newlyConfirmed = planned.filter(
    (p) =>
      (p.row.action === "create" || p.row.action === "update") &&
      p.memberSet.status === "confirmed",
  ).length;
  const leaving = planned.filter(
    (p) =>
      p.row.action === "update" &&
      p.hasMember &&
      p.memberSet.status !== undefined &&
      p.memberSet.status !== "confirmed" &&
      memberOf.get(p.targetPersonId ?? "")?.status === "confirmed",
  ).length;
  const after = confirmed + newlyConfirmed - leaving;
  if (capacity !== null && after > capacity)
    warnings.push(
      `This import takes confirmed members to ${after}, over the capacity of ${capacity}.`,
    );
  const report: ImportReport = {
    headers,
    mapping,
    rows: planned.map((p) => p.row),
    counts,
    warnings,
  };
  return { report, planned };
}

/** Dry run: the report only, nothing written. Admins only (member.import). */
export async function planImport(ctx: PeopleCtx, input: ImportInput): Promise<ImportReport> {
  if (!can(ctx.actor, "member.import")) throw new ForbiddenError();
  return (await plan(ctx.db, ctx, input)).report;
}

/** Apply: creates and updates in one transaction, rows with errors or unresolved duplicates skipped. */
export async function applyImport(ctx: PeopleCtx, input: ImportInput) {
  if (!can(ctx.actor, "member.import")) throw new ForbiddenError();
  const now = ctx.now ?? new Date();
  const run = async (tx: DbOrTx) => {
    const { report, planned } = await plan(tx, ctx, input);
    let created = 0;
    let updated = 0;
    for (const p of planned) {
      if (p.row.action !== "create" && p.row.action !== "update") continue;
      const memberSet = {
        ...p.memberSet,
        importSource: input.fileName,
        updatedAt: now,
        ...(p.memberSet.paymentStatus !== undefined ? { paymentStatusSyncedAt: now } : {}),
      };
      let personId = p.targetPersonId;
      if (!personId) {
        const email = p.values.email ?? "";
        personId = firstRow(
          await tx
            .insert(people)
            .values({
              email,
              displayName: p.values.displayName ?? email,
              ...p.personSet,
              importBatchId: input.importBatchId ?? null,
            })
            .returning({ id: people.id }),
        ).id;
        created++;
      } else {
        if (Object.keys(p.personSet).length)
          await tx
            .update(people)
            .set({ ...p.personSet, updatedAt: now })
            .where(eq(people.id, personId));
        updated++;
      }
      if (p.hasMember) {
        await tx
          .update(editionMembers)
          .set(memberSet)
          .where(
            and(
              eq(editionMembers.personId, personId),
              eq(editionMembers.editionId, ctx.edition.id),
            ),
          );
      } else {
        await tx
          .insert(editionMembers)
          .values({ editionId: ctx.edition.id, personId, status: "prospect", ...memberSet });
      }
    }
    const skipped = report.counts.duplicate + report.counts.error;
    if (created || updated) {
      await recordAudit(
        tx,
        { actor: ctx.actor, actorKind: "import", editionId: ctx.edition.id },
        {
          action: "member.import_applied",
          entity: { type: "base.edition", id: ctx.edition.id },
          changes: { fileName: input.fileName, created, updated, skipped },
          significance: "significant",
        },
      );
    }
    return { ...report, applied: { created, updated, skipped } };
  };
  return "transaction" in ctx.db ? ctx.db.transaction(run) : run(ctx.db);
}
