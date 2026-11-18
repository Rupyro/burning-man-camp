"use server";
// Camp fees (applicants spec §6): record that an accepted applicant paid. Demo only.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction, ValidationError } from "@/base/api";
import { financeCampFees as fees } from "../schema";

/** Record a camp fee as paid (never your own) and tell whoever asked for it. */
export const recordFeePayment = moduleAction(
  "finance",
  {
    input: z.object({ id: z.string().uuid() }),
    capability: "finance.fees.manage",
    resource: async ({ id }, ctx) => {
      const [row] = await ctx.db
        .select({ personId: fees.personId })
        .from(fees)
        .where(and(eq(fees.id, id), eq(fees.editionId, ctx.edition.id)));
      return row ? { personId: row.personId } : { personId: ctx.actor.personId };
    },
  },
  async (ctx, { id }) => {
    const [fee] = await ctx.tx
      .select()
      .from(fees)
      .where(and(eq(fees.id, id), eq(fees.editionId, ctx.edition.id)))
      .for("update");
    if (!fee) throw new ValidationError("Fee not found", []);
    if (fee.status !== "due") return { changed: false };
    await ctx.tx
      .update(fees)
      .set({
        status: "paid",
        paidAt: ctx.now,
        recordedByPersonId: ctx.actor.personId,
        updatedAt: ctx.now,
        version: fee.version + 1,
      })
      .where(eq(fees.id, fee.id));
    await ctx.audit.record({
      action: "finance.fee.paid",
      entity: { type: "finance.camp_fee", id: fee.id },
      changes: { status: ["due", "paid"], amountCents: fee.amountCents },
      significance: "significant",
    });
    await ctx.events.emit("finance.fee.paid", {
      v: 1,
      feeId: fee.id,
      personId: fee.personId,
      editionId: fee.editionId,
      paidAt: ctx.now.toISOString(),
      source: { refType: fee.sourceRefType, refId: fee.sourceRefId },
    });
    return { changed: true };
  },
);
