import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { invites, people, user } from "../schema";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findPersonByEmail(db: DbOrTx, email: string) {
  const [row] = await db
    .select()
    .from(people)
    .where(and(sql`lower(${people.email}) = ${normaliseEmail(email)}`, isNull(people.deletedAt)));
  return row ?? null;
}

/** A live invite: not revoked, and either accepted already or not yet expired. */
export async function findLiveInviteForPerson(db: DbOrTx, personId: string, now = new Date()) {
  const [row] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.personId, personId),
        isNull(invites.revokedAt),
        isNull(invites.deletedAt),
        or(sql`${invites.acceptedAt} is not null`, gt(invites.expiresAt, now)),
      ),
    )
    .orderBy(sql`${invites.createdAt} desc`)
    .limit(1);
  return row ?? null;
}

/**
 * Invite-only: an email may receive a login link if it already has a login, or
 * belongs to a person with a live invite. Everyone else is refused.
 */
export async function canEmailSignIn(db: DbOrTx, email: string): Promise<boolean> {
  const normalised = normaliseEmail(email);
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, normalised));
  if (existing) {
    const person = await findPersonByEmail(db, normalised);
    return person !== null && person.deletedAt === null;
  }
  const person = await findPersonByEmail(db, normalised);
  if (!person) return false;
  return (await findLiveInviteForPerson(db, person.id)) !== null;
}
