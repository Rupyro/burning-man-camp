import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { ForbiddenError, ValidationError } from "../errors";
import type { PeopleCtx } from "../people/directory";
import { capacityStatus } from "../people/members";
import { anchorDates, editions } from "../schema";

const inTx = <T>(db: DbOrTx, fn: (tx: DbOrTx) => Promise<T>) =>
  "transaction" in db ? db.transaction(fn) : fn(db);

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new ValidationError(
      "Invalid input",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  return r.data;
}

const editionInput = z.strictObject({
  title: z.string().trim().min(1).max(80).optional(),
  memberCapacity: z.number().int().min(1).max(1000).optional(),
});

/** Edition title and member capacity (edition.manage). Capacity is a setting, default 70. */
export async function updateEdition(ctx: PeopleCtx, raw: z.input<typeof editionInput>) {
  if (!can(ctx.actor, "edition.manage")) throw new ForbiddenError();
  const input = parse(editionInput, raw);
  return inTx(ctx.db, async (tx) => {
    const [before] = await tx.select().from(editions).where(eq(editions.id, ctx.edition.id));
    if (!before) throw new ForbiddenError();
    const changes: Record<string, [unknown, unknown]> = {};
    if (input.title !== undefined && input.title !== before.title)
      changes.title = [before.title, input.title];
    if (input.memberCapacity !== undefined && input.memberCapacity !== before.memberCapacity)
      changes.memberCapacity = [before.memberCapacity, input.memberCapacity];
    if (!Object.keys(changes).length) return { changed: false };
    await tx
      .update(editions)
      .set({ ...input, updatedAt: ctx.now ?? new Date() })
      .where(eq(editions.id, ctx.edition.id));
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "edition.updated",
        entity: { type: "base.edition", id: ctx.edition.id },
        changes,
        significance: "significant",
      },
    );
    return { changed: true };
  });
}

const anchorInput = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  label: z.string().trim().min(1).max(80),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  isConfirmed: z.boolean().default(false),
  sourceNote: z.string().max(200).nullable().optional(),
});

/** Create or move an anchor date ("build_start"), with a confirmed flag (UI shows "TBC"). */
export async function setAnchorDate(ctx: PeopleCtx, raw: z.input<typeof anchorInput>) {
  if (!can(ctx.actor, "edition.manage")) throw new ForbiddenError();
  const input = parse(anchorInput, raw);
  if (input.endsAt && input.endsAt < input.startsAt)
    throw new ValidationError("An anchor date can't end before it starts");
  return inTx(ctx.db, async (tx) => {
    const [before] = await tx
      .select()
      .from(anchorDates)
      .where(and(eq(anchorDates.editionId, ctx.edition.id), eq(anchorDates.key, input.key)));
    const values = { ...input, endsAt: input.endsAt ?? null, sourceNote: input.sourceNote ?? null };
    if (before) {
      await tx
        .update(anchorDates)
        .set({ ...values, deletedAt: null, updatedAt: ctx.now ?? new Date() })
        .where(eq(anchorDates.id, before.id));
    } else {
      await tx.insert(anchorDates).values({ editionId: ctx.edition.id, ...values });
    }
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "edition.anchor_set",
        entity: { type: "base.edition", id: ctx.edition.id },
        changes: {
          [input.key]: [before?.startsAt.toISOString() ?? null, input.startsAt.toISOString()],
          isConfirmed: [before?.isConfirmed ?? null, input.isConfirmed],
        },
        significance: "significant",
      },
    );
  });
}

export async function listAnchorDates(db: DbOrTx, editionId: string) {
  return db
    .select()
    .from(anchorDates)
    .where(and(eq(anchorDates.editionId, editionId), isNull(anchorDates.deletedAt)))
    .orderBy(asc(anchorDates.startsAt));
}

/** Everything the /edition screen shows (spec b1-12 E1). Only for edition.manage. */
export async function getEditionSettings(ctx: PeopleCtx) {
  if (!can(ctx.actor, "edition.manage")) throw new ForbiddenError();
  const [ed] = await ctx.db.select().from(editions).where(eq(editions.id, ctx.edition.id));
  if (!ed) throw new ForbiddenError();
  const { confirmed } = await capacityStatus(ctx.db, ctx.edition.id);
  const anchors = await listAnchorDates(ctx.db, ctx.edition.id);
  return {
    title: ed.title,
    year: ed.year,
    capacity: ed.memberCapacity,
    confirmed,
    anchors: anchors.map((a) => ({
      key: a.key,
      label: a.label,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      isConfirmed: a.isConfirmed,
      sourceNote: a.sourceNote,
    })),
  };
}
