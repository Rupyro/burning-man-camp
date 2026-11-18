// Burn Mode reads and writes (rules in ./burn-rules). Only ever the caller's own row.
import { and, eq, isNotNull } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { type EngineCtx, nowOf } from "../engine/shared";
import { ForbiddenError, ValidationError } from "../errors";
import { campSettings, editionMembers } from "../schema";
import type { BurnState } from "./burn-rules";

export async function burnStateOf(
  db: DbOrTx,
  editionId: string,
  personId: string,
): Promise<BurnState> {
  const [m] = await db
    .select({
      onAt: editionMembers.burnModeOnAt,
      arrivalAt: editionMembers.arrivalAt,
      promptDismissedAt: editionMembers.burnPromptDismissedAt,
    })
    .from(editionMembers)
    .where(and(eq(editionMembers.editionId, editionId), eq(editionMembers.personId, personId)));
  return m ?? { onAt: null, arrivalAt: null, promptDismissedAt: null };
}

/** Whether this person has Burn Mode on in the camp's current edition. */
export async function isInBurnMode(db: DbOrTx, personId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: editionMembers.id })
    .from(editionMembers)
    .innerJoin(campSettings, eq(campSettings.currentEditionId, editionMembers.editionId))
    .where(and(eq(editionMembers.personId, personId), isNotNull(editionMembers.burnModeOnAt)));
  return Boolean(row);
}

async function updateMine(ctx: EngineCtx, set: Partial<typeof editionMembers.$inferInsert>) {
  if (!ctx.actor.personId) throw new ForbiddenError();
  const rows = await ctx.db
    .update(editionMembers)
    .set({ ...set, updatedAt: nowOf(ctx) })
    .where(
      and(
        eq(editionMembers.editionId, ctx.edition.id),
        eq(editionMembers.personId, ctx.actor.personId),
      ),
    )
    .returning({ id: editionMembers.id });
  if (!rows.length) throw new ValidationError("You're not on this year's camp list");
}

/** Switch my own Burn Mode on or off. Switching on also answers the arrival prompt. */
export async function setMyBurnMode(ctx: EngineCtx, on: boolean) {
  const now = nowOf(ctx);
  await updateMine(
    ctx,
    on ? { burnModeOnAt: now, burnPromptDismissedAt: now } : { burnModeOnAt: null },
  );
  return { on };
}

/** "Not now" on the welcome screen: it never comes back (the switch stays in My profile). */
export async function dismissMyBurnPrompt(ctx: EngineCtx) {
  await updateMine(ctx, { burnPromptDismissedAt: nowOf(ctx) });
  return { dismissed: true };
}

/** My profile: "Ask me on my arrival day" on (clears the answer) or off (counts as answered). */
export async function setMyBurnAsk(ctx: EngineCtx, ask: boolean) {
  await updateMine(ctx, { burnPromptDismissedAt: ask ? null : nowOf(ctx) });
  return { ask };
}
