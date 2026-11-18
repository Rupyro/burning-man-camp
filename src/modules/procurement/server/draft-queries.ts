import "server-only";
// Reads for the drafts page: my open drafts and the last few I sent or discarded.
import { and, desc, eq } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { procurementDrafts as drafts } from "../schema";

export async function myDrafts(ctx: ModuleContext, limit = 10) {
  const me = ctx.actor.personId;
  if (!me) return [];
  return ctx.db
    .select()
    .from(drafts)
    .where(and(eq(drafts.editionId, ctx.edition.id), eq(drafts.personId, me)))
    .orderBy(desc(drafts.createdAt))
    .limit(limit);
}
