// Ingestion stage (c): store an uploaded sheet as a batch for admin review. Admins only.
// Stage (d) writes approved rows through an importer from the owning module; (e) undoes them.
import { asc, desc, eq } from "drizzle-orm";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { ForbiddenError, ValidationError } from "../errors";
import { importBatches, importBatchRows } from "../schema";
import { analyseFile, type Kind } from "./clean";
import { familyImporter } from "./family-importer";
import { memberImporter } from "./member-importer";

export interface BatchCtx {
  db: DbOrTx;
  actor: Actor;
  /** The year being imported into (needs, member records). */
  edition?: { id: string; year: number };
  now?: Date;
}
export type Decision = "accept" | "fix" | "skip";

function admin(ctx: BatchCtx) {
  if (!ctx.actor.isAdmin) throw new ForbiddenError();
}

/** Rows the cleaner was happy with start as "accept"; everything else waits for a person. */
const startDecision = (label: string) =>
  label === "ok" || label === "cleaned" ? "accept" : "pending";

export async function createBatch(
  ctx: BatchCtx,
  input: { kind: Kind; fileName: string; csv: string },
): Promise<string> {
  admin(ctx);
  const { report, details } = analyseFile(input.kind, input.csv, { now: ctx.now });
  if (!report.rows.length) throw new ValidationError("The file has no rows");
  const { rows: _rows, headers, ...summary } = report;
  const batch = firstRow(
    await ctx.db
      .insert(importBatches)
      .values({
        kind: input.kind,
        fileName: input.fileName.slice(0, 200),
        summary,
        headers,
        uploadedByPersonId: ctx.actor.personId,
      })
      .returning({ id: importBatches.id }),
    "import batch",
  );
  await ctx.db.insert(importBatchRows).values(
    report.rows.map((r, i) => ({
      batchId: batch.id,
      line: r.line,
      label: r.label,
      issues: r.issues,
      changes: r.changes,
      raw: details[i]?.raw ?? {},
      cleaned: details[i]?.cleaned ?? {},
      duplicateOfLine: details[i]?.duplicateOfLine ?? null,
      decision: startDecision(r.label),
    })),
  );
  await recordAudit(
    ctx.db,
    { actor: ctx.actor },
    {
      action: "ingest.batch.create",
      entity: { type: "import_batch", id: batch.id },
      changes: { kind: input.kind, counts: report.counts },
    },
  );
  return batch.id;
}

export async function listBatches(ctx: BatchCtx) {
  admin(ctx);
  return ctx.db.select().from(importBatches).orderBy(desc(importBatches.uploadedAt)).limit(50);
}

export async function getBatch(ctx: BatchCtx, id: string) {
  admin(ctx);
  const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) throw new ValidationError("No such import batch");
  const rows = await ctx.db
    .select()
    .from(importBatchRows)
    .where(eq(importBatchRows.batchId, id))
    .orderBy(asc(importBatchRows.line));
  return { batch, rows };
}

export async function decideRow(
  ctx: BatchCtx,
  input: {
    rowId: string;
    decision: Decision;
    fix?: Record<string, string>;
    setResponsible?: boolean;
  },
): Promise<void> {
  admin(ctx);
  const [row] = await ctx.db
    .select({ row: importBatchRows, status: importBatches.status })
    .from(importBatchRows)
    .innerJoin(importBatches, eq(importBatches.id, importBatchRows.batchId))
    .where(eq(importBatchRows.id, input.rowId));
  if (!row) throw new ValidationError("No such row");
  if (row.status !== "review") throw new ValidationError("This batch is no longer in review");
  const fix = input.decision === "fix" ? input.fix : undefined;
  if (input.decision === "fix" && (!fix || !Object.keys(fix).length))
    throw new ValidationError("Say what to fix");
  const responsible = (row.row.cleaned as Record<string, unknown>).responsible;
  if (input.setResponsible && typeof responsible !== "string")
    throw new ValidationError("This row has no person name in its status");
  await ctx.db
    .update(importBatchRows)
    .set({
      decision: input.decision,
      fix: fix ?? null,
      setResponsible: Boolean(input.setResponsible) && input.decision !== "skip",
      decidedByPersonId: ctx.actor.personId,
      decidedAt: ctx.now ?? new Date(),
    })
    .where(eq(importBatchRows.id, input.rowId));
  await recordAudit(
    ctx.db,
    { actor: ctx.actor },
    {
      action: "ingest.row.decide",
      entity: { type: "import_batch", id: row.row.batchId },
      changes: {
        line: row.row.line,
        decision: input.decision,
        setResponsible: Boolean(input.setResponsible),
      },
    },
  );
}

/** One approved row as an importer sees it: cleaned values with the admin's fix on top. */
export interface ApprovedRow {
  line: number;
  values: Record<string, unknown>;
  setResponsible: boolean;
}
/** Writes one kind of batch into its own tables, stamping import_batch_id. Lives in the module
 * that owns those tables; the app passes it in, so base never imports a module. */
export interface BatchImporter {
  apply(
    db: DbOrTx,
    batchId: string,
    rows: ApprovedRow[],
    opts?: { editionId?: string },
  ): Promise<{ added: number; alreadyThere: number }>;
  undo(db: DbOrTx, batchId: string): Promise<{ removed: number; keptInUse: number }>;
}
export type Importers = Partial<Record<Kind, BatchImporter>>;

/** The module's importer, or the built-in member importer for members batches. */
async function importerFor(
  ctx: BatchCtx,
  batch: typeof importBatches.$inferSelect,
  importers: Importers,
) {
  const given =
    importers[batch.kind as Kind] ?? (batch.kind === "family" ? familyImporter : undefined);
  if (given || batch.kind !== "members" || !ctx.edition) return given;
  const rows = await ctx.db
    .select({ line: importBatchRows.line, raw: importBatchRows.raw, fix: importBatchRows.fix })
    .from(importBatchRows)
    .where(eq(importBatchRows.batchId, batch.id));
  return memberImporter({
    actor: ctx.actor,
    edition: ctx.edition,
    headers: batch.headers as string[],
    rowsByLine: new Map(
      rows.map((r) => [
        r.line,
        {
          raw: r.raw as Record<string, string>,
          fix: (r.fix as Record<string, unknown> | null) ?? {},
        },
      ]),
    ),
  });
}

async function loadBatch(ctx: BatchCtx, id: string) {
  const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) throw new ValidationError("No such import batch");
  return batch;
}

/** Approve once no row is waiting, then write accepted and fixed rows (if this kind has an
 * importer). Safe to run again: the importer skips anything already there. */
export async function approveBatch(
  ctx: BatchCtx,
  id: string,
  importers: Importers,
): Promise<{ added: number; alreadyThere: number }> {
  admin(ctx);
  const batch = await loadBatch(ctx, id);
  if (batch.status === "rolled_back") throw new ValidationError("This import was undone");
  const rows = await ctx.db
    .select()
    .from(importBatchRows)
    .where(eq(importBatchRows.batchId, id))
    .orderBy(asc(importBatchRows.line));
  if (rows.some((r) => r.decision === "pending"))
    throw new ValidationError("Some rows still need a decision");
  const importer = await importerFor(ctx, batch, importers);
  const approved: ApprovedRow[] = rows
    .filter((r) => r.decision === "accept" || r.decision === "fix")
    .map((r) => ({
      line: r.line,
      values: {
        ...(r.cleaned as Record<string, unknown>),
        ...((r.fix as Record<string, unknown> | null) ?? {}),
      },
      setResponsible: r.setResponsible,
    }));
  const result = importer
    ? await importer.apply(ctx.db, id, approved, { editionId: ctx.edition?.id })
    : { added: 0, alreadyThere: 0 };
  await ctx.db
    .update(importBatches)
    .set({
      status: importer ? "imported" : "approved",
      approvedByPersonId: batch.approvedByPersonId ?? ctx.actor.personId,
      approvedAt: batch.approvedAt ?? ctx.now ?? new Date(),
    })
    .where(eq(importBatches.id, id));
  await recordAudit(
    ctx.db,
    { actor: ctx.actor },
    {
      action: "ingest.batch.approve",
      entity: { type: "import_batch", id },
      changes: result,
      significance: "significant",
    },
  );
  return result;
}

/** Remove exactly the rows stamped with this batch's id. Rows something else now uses stay. */
export async function undoBatch(
  ctx: BatchCtx,
  id: string,
  importers: Importers,
): Promise<{ removed: number; keptInUse: number }> {
  admin(ctx);
  const batch = await loadBatch(ctx, id);
  const importer = await importerFor(ctx, batch, importers);
  if (batch.status !== "imported" || !importer)
    throw new ValidationError("Only an imported batch can be undone");
  const result = await importer.undo(ctx.db, id);
  await ctx.db.update(importBatches).set({ status: "rolled_back" }).where(eq(importBatches.id, id));
  await recordAudit(
    ctx.db,
    { actor: ctx.actor },
    {
      action: "ingest.batch.undo",
      entity: { type: "import_batch", id },
      changes: result,
      significance: "significant",
    },
  );
  return result;
}
