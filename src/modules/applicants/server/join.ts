import "server-only";
import { and, eq } from "drizzle-orm";
import type { ActionContext } from "@/base/api";
import { readyToJoin } from "../rules/journey";
import { applicantApplications as apps, applicantDocuments as docs } from "../schema";

/**
 * Joined = paid + every requirement done, including the interview (spec §2). Called after anything
 * that might complete the list (a document, acceptance, the fee). When it's all there, the
 * application becomes "joined" and the base confirms the membership, so the next page load shows
 * the member home. Idempotent: a joined application is left alone.
 */
export async function joinIfReady(ctx: ActionContext, applicationId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select()
    .from(apps)
    .where(and(eq(apps.id, applicationId), eq(apps.editionId, ctx.edition.id)))
    .for("update");
  if (!row) return false;
  const done = await ctx.tx
    .select({ docKey: docs.docKey })
    .from(docs)
    .where(eq(docs.applicationId, row.id));
  if (!readyToJoin({ ...row, docsDone: done.map((d) => d.docKey) })) return false;
  await ctx.tx
    .update(apps)
    .set({ status: "joined", joinedAt: ctx.now, updatedAt: ctx.now, version: row.version + 1 })
    .where(eq(apps.id, row.id));
  await ctx.membership.confirmJoined(row.personId);
  await ctx.audit.record({
    action: "applicants.application.joined",
    entity: { type: "applicants.application", id: row.id },
    changes: { status: [row.status, "joined"] },
    significance: "significant",
  });
  return true;
}
