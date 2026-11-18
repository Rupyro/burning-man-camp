import { and, eq, inArray, isNull } from "drizzle-orm";
import { recordAudit } from "../audit/audit";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { editionMembers } from "../schema";

export interface MembershipApi {
  /**
   * An applicant has paid and met every requirement (spec applicants §2): their edition membership
   * becomes confirmed with payment paid_in_full, audited. Only prospects and waitlisted people
   * move; anyone else is left alone ({ changed: false }). Idempotent.
   */
  confirmJoined(personId: string): Promise<{ changed: boolean }>;
}

export function createMembershipApi(
  db: DbOrTx,
  scope: { actor: Actor; editionId: string; now: Date; requestId?: string },
): MembershipApi {
  return {
    async confirmJoined(personId) {
      const rows = await db
        .update(editionMembers)
        .set({
          status: "confirmed",
          paymentStatus: "paid_in_full",
          paymentStatusSyncedAt: scope.now,
          updatedAt: scope.now,
        })
        .where(
          and(
            eq(editionMembers.personId, personId),
            eq(editionMembers.editionId, scope.editionId),
            inArray(editionMembers.status, ["prospect", "waitlisted"]),
            isNull(editionMembers.deletedAt),
          ),
        )
        .returning({ id: editionMembers.id });
      const row = rows[0];
      if (!row) return { changed: false };
      await recordAudit(
        db,
        { actor: scope.actor, editionId: scope.editionId, requestId: scope.requestId },
        {
          action: "member.status_changed",
          entity: { type: "base.edition_member", id: row.id },
          changes: { status: ["applicant", "confirmed"], paymentStatus: [null, "paid_in_full"] },
          significance: "significant",
        },
      );
      return { changed: true };
    },
  };
}
