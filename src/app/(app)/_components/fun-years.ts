import "server-only";
import { eq } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { pastFamilyYearsFor } from "@/base/ingest/family-importer";
import { people } from "@/base/schema";
import type { ensureRegistry } from "../../boot";

/** Confirmed camp years from any module that knows them (Oe-aa-sies Family). Never blocks the page. */
export async function myFunYears(
  registry: ReturnType<typeof ensureRegistry>,
  ctx: ModuleContext,
): Promise<number[]> {
  const lists = await Promise.all(
    registry.modules.map((m) =>
      m.funYears ? m.funYears(ctx).catch(() => [] as number[]) : ([] as number[]),
    ),
  );
  const past = await pastYears(ctx).catch(() => [] as number[]);
  return [...new Set([...lists.flat(), ...past])].sort((a, b) => a - b);
}

/** Years from old sheets (past_family_years), matched by person or their email. */
async function pastYears(ctx: ModuleContext): Promise<number[]> {
  const personId = ctx.actor.personId;
  if (!personId) return [];
  const [me] = await ctx.db
    .select({ email: people.email })
    .from(people)
    .where(eq(people.id, personId));
  return pastFamilyYearsFor(ctx.db, { personId, email: me?.email ?? null });
}
