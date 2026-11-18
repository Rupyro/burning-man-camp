import { and, inArray, isNull, notLike, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { ForbiddenError } from "../errors";
import { people } from "../schema";
import { DEMO_DOMAIN, demoFlagOn, PERSONAS } from "./personas";

export type DemoStatus =
  | { on: true }
  | { on: false; reason: "flag_off" | "real_people" | "not_seeded" };

/**
 * Demo mode is on only when the flag is set AND the database is the fake demo one: every person
 * is on the example.test domain, and the personas exist. Otherwise it stays off (fails closed).
 */
export async function demoStatus(db: DbOrTx): Promise<DemoStatus> {
  if (!demoFlagOn()) return { on: false, reason: "flag_off" };
  const [real] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(people)
    .where(and(isNull(people.deletedAt), notLike(sql`lower(${people.email})`, `%${DEMO_DOMAIN}`)));
  if ((real?.n ?? 0) > 0) return { on: false, reason: "real_people" };
  const found = await db
    .select({ email: people.email })
    .from(people)
    .where(
      and(
        isNull(people.deletedAt),
        inArray(
          people.email,
          PERSONAS.map((p) => p.email),
        ),
      ),
    );
  if (found.length < PERSONAS.length) return { on: false, reason: "not_seeded" };
  return { on: true };
}

export async function requireDemo(db: DbOrTx): Promise<void> {
  const s = await demoStatus(db);
  if (!s.on) throw new ForbiddenError();
}

export async function isDemoOn(db: DbOrTx): Promise<boolean> {
  return (await demoStatus(db)).on;
}

export const personaByEmail = (email: string) =>
  PERSONAS.find((p) => p.email === email.toLowerCase());
