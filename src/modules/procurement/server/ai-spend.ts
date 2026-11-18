import "server-only";
// This month's AI spend across every AI part (asks and drafts), checked against one limit.
import { gte, sql } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { procurementAskLog as asks, procurementDrafts as drafts } from "../schema";

export async function aiSpentThisMonth(db: ModuleContext["db"], now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [a] = await db
    .select({ c: sql<number>`coalesce(sum(${asks.aiCostCents}), 0)::int` })
    .from(asks)
    .where(gte(asks.createdAt, start));
  const [d] = await db
    .select({ c: sql<number>`coalesce(sum(${drafts.aiCostCents}), 0)::int` })
    .from(drafts)
    .where(gte(drafts.createdAt, start));
  return (a?.c ?? 0) + (d?.c ?? 0);
}
