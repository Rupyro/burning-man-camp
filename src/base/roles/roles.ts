import { and, asc, eq, isNull, or } from "drizzle-orm";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { ForbiddenError, ValidationError } from "../errors";
import type { PeopleCtx } from "../people/directory";
import { people, roleAssignments, roles } from "../schema";

/** Roles that hold for every year until revoked; the rest are granted for the current edition. */
const PERMANENT = new Set(["admin"]);

const inTx = <T>(db: DbOrTx, fn: (tx: DbOrTx) => Promise<T>) =>
  "transaction" in db ? db.transaction(fn) : fn(db);

async function roleByKey(db: DbOrTx, key: string) {
  const [role] = await db.select().from(roles).where(eq(roles.key, key));
  if (!role) throw new ValidationError(`Unknown role "${key}"`);
  return role;
}

const liveFor = (editionId: string) =>
  and(
    isNull(roleAssignments.deletedAt),
    or(isNull(roleAssignments.editionId), eq(roleAssignments.editionId, editionId)),
  );

/** Who holds which role this edition (officer roles are camp info, so members see this). */
export async function listRoleHolders(ctx: PeopleCtx) {
  if (!can(ctx.actor, "member.view_directory")) throw new ForbiddenError();
  return ctx.db
    .select({
      personId: people.id,
      displayName: people.displayName,
      roleKey: roles.key,
      roleLabel: roles.label,
      kind: roles.kind,
      permanent: isNull(roleAssignments.editionId),
    })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .innerJoin(people, eq(people.id, roleAssignments.personId))
    .where(and(liveFor(ctx.edition.id), isNull(people.deletedAt)))
    .orderBy(asc(roles.label), asc(people.displayName));
}

export async function listRoles(db: DbOrTx) {
  return db.select().from(roles).where(isNull(roles.deletedAt)).orderBy(asc(roles.label));
}

/** Grant a role (role.assign: admins only). Granting a role someone already holds is a no-op. */
export async function grantRole(ctx: PeopleCtx, input: { personId: string; roleKey: string }) {
  if (!can(ctx.actor, "role.assign", { roleKey: input.roleKey })) throw new ForbiddenError();
  return inTx(ctx.db, async (tx) => {
    const role = await roleByKey(tx, input.roleKey);
    const [held] = await tx
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.personId, input.personId),
          eq(roleAssignments.roleId, role.id),
          liveFor(ctx.edition.id),
        ),
      );
    if (held) return { changed: false };
    const editionId = PERMANENT.has(role.key) ? null : ctx.edition.id;
    await tx.insert(roleAssignments).values({
      personId: input.personId,
      roleId: role.id,
      editionId,
      grantedByPersonId: ctx.actor.personId,
    });
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "role.granted",
        entity: { type: "base.person", id: input.personId },
        changes: { role: [null, role.key], editionId: [null, editionId] },
        significance: "security",
      },
    );
    return { changed: true };
  });
}

/** Revoke a role. An admin can't remove their own admin role (so the camp can't lock itself out). */
export async function revokeRole(ctx: PeopleCtx, input: { personId: string; roleKey: string }) {
  if (!can(ctx.actor, "role.assign", { roleKey: input.roleKey })) throw new ForbiddenError();
  if (input.roleKey === "admin" && input.personId === ctx.actor.personId)
    throw new ValidationError("You can't remove your own admin role. Ask another admin.");
  return inTx(ctx.db, async (tx) => {
    const role = await roleByKey(tx, input.roleKey);
    const now = ctx.now ?? new Date();
    const removed = await tx
      .update(roleAssignments)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(roleAssignments.personId, input.personId),
          eq(roleAssignments.roleId, role.id),
          liveFor(ctx.edition.id),
        ),
      )
      .returning({ id: roleAssignments.id });
    if (!removed.length) return { changed: false };
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "role.revoked",
        entity: { type: "base.person", id: input.personId },
        changes: { role: [role.key, null] },
        significance: "security",
      },
    );
    return { changed: true };
  });
}
