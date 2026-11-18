import { and, eq, gt, isNull } from "drizzle-orm";
import { CAMP_NAME } from "@/lib/camp";
import { randomToken, sha256 } from "@/lib/crypto";
import { addDays } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import type { Actor } from "../authz/actor";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { getEmailAdapter } from "../email/adapter";
import { ForbiddenError } from "../errors";
import { editionMembers, invites, people } from "../schema";
import { findPersonByEmail, normaliseEmail } from "./eligibility";

export const INVITE_DAYS = 30;

export interface CreateInviteInput {
  email: string;
  displayName: string;
  editionId: string;
  /** null/system = CLI or seed. People need admin.settings (B1 may widen this to community leads). */
  invitedBy: Actor;
  now?: Date;
  sendEmail?: boolean;
  /**
   * "confirmed" (default): an invited member. "prospect": someone who signed up to apply (spec
   * applicants §1); an existing membership is never changed by a prospect invite.
   */
  status?: "confirmed" | "prospect";
}

/**
 * Invite someone: creates (or reuses) the person, marks them confirmed for the
 * edition, stores only the token hash, audits, and emails the invite link.
 */
export async function createInvite(db: DbOrTx, input: CreateInviteInput) {
  if (!input.invitedBy.isSystem && !can(input.invitedBy, "admin.settings"))
    throw new ForbiddenError();
  const now = input.now ?? new Date();
  const email = normaliseEmail(input.email);
  const token = randomToken();

  const run = async (tx: DbOrTx) => {
    const person =
      (await findPersonByEmail(tx, email)) ??
      firstRow(
        await tx.insert(people).values({ email, displayName: input.displayName }).returning(),
        "person",
      );
    const member = tx.insert(editionMembers).values({
      editionId: input.editionId,
      personId: person.id,
      status: input.status ?? "confirmed",
    });
    if (input.status === "prospect") await member.onConflictDoNothing();
    else
      await member.onConflictDoUpdate({
        target: [editionMembers.editionId, editionMembers.personId],
        set: { status: "confirmed", updatedAt: now },
      });
    const invite = firstRow(
      await tx
        .insert(invites)
        .values({
          personId: person.id,
          editionId: input.editionId,
          tokenHash: sha256(token),
          invitedByPersonId: input.invitedBy.personId,
          expiresAt: addDays(now, INVITE_DAYS),
        })
        .returning(),
      "invite",
    );
    await recordAudit(
      tx,
      { actor: input.invitedBy, editionId: input.editionId },
      {
        action: "invite.created",
        entity: { type: "base.invite", id: invite.id },
        changes: { personId: [null, person.id], expiresAt: [null, invite.expiresAt.toISOString()] },
        significance: "security",
      },
    );
    return { invite, person };
  };
  const { invite, person } = "transaction" in db ? await db.transaction(run) : await run(db);

  const url = `${getEnv().BETTER_AUTH_URL}/invite/${token}`;
  if (input.sendEmail !== false) {
    await getEmailAdapter().send({
      to: email,
      subject: `You're invited to the ${CAMP_NAME} camp app`,
      text: `Hi ${person.displayName},\n\nYou've been invited to the ${CAMP_NAME} camp app.\nOpen this link to get your login link (valid ${INVITE_DAYS} days):\n${url}`,
      tag: "auth.invite",
      link: url,
    });
  }
  return { inviteId: invite.id, personId: person.id, token, url };
}

/** Look up a live, unexpired invite by its raw token. */
export async function findInviteByToken(db: DbOrTx, token: string, now = new Date()) {
  const [row] = await db
    .select({ invite: invites, person: people })
    .from(invites)
    .innerJoin(people, eq(people.id, invites.personId))
    .where(
      and(
        eq(invites.tokenHash, sha256(token)),
        isNull(invites.revokedAt),
        isNull(invites.deletedAt),
        gt(invites.expiresAt, now),
      ),
    );
  return row ?? null;
}
