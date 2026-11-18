import { eq, max, sql } from "drizzle-orm";
import type { ActionContext } from "@/base/api";
import { campSettings } from "@/base/api/schema";
import { spendRef } from "../rules/ref";
import { financeSpendRequests as r } from "../schema";

/** The next spend request ref for this edition (serialised per edition by an advisory lock). */
export async function nextRef(ctx: Pick<ActionContext, "tx" | "edition">) {
  await ctx.tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`finance_ref:${ctx.edition.id}`}))`,
  );
  const [m] = await ctx.tx
    .select({ n: max(r.refSeq) })
    .from(r)
    .where(eq(r.editionId, ctx.edition.id));
  const [camp] = await ctx.tx.select({ prefix: campSettings.refPrefix }).from(campSettings);
  const seq = (m?.n ?? 0) + 1;
  return { refSeq: seq, refCode: spendRef(camp?.prefix ?? "OEA", seq) };
}
