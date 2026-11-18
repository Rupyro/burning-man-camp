import "server-only";
import type { ModuleContext } from "@/base/api";
import { familyFor } from "./family-queries";

/** Confirmed Oe-aa-sies Family years for the signed-in person (empty if none). */
export async function familyYearsOf(ctx: ModuleContext): Promise<number[]> {
  if (!ctx.actor.personId) return [];
  return (await familyFor(ctx.db, ctx.actor.personId)).confirmed;
}
