import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { ForbiddenError, ValidationError } from "../errors";
import {
  availabilityWindows,
  editionMembers,
  editions,
  memberAdminNotes,
  people,
  personSkills,
  skills,
} from "../schema";
import type { PeopleCtx } from "./directory";
import {
  MEMBER_FIELDS,
  PERSON_FIELDS,
  type ProfileInput,
  profileInput,
  REDACTED_FIELDS,
} from "./profile-input";
import { personResource } from "./resources";

export type MemberStatus = "prospect" | "waitlisted" | "confirmed" | "withdrawn" | "removed";

function inTx<T>(db: DbOrTx, fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  return "transaction" in db ? db.transaction(fn) : fn(db);
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
const same = (a: unknown, b: unknown) => JSON.stringify(iso(a)) === JSON.stringify(iso(b));

async function memberRow(db: DbOrTx, editionId: string, personId: string) {
  const [m] = await db
    .select()
    .from(editionMembers)
    .where(
      and(
        eq(editionMembers.personId, personId),
        eq(editionMembers.editionId, editionId),
        isNull(editionMembers.deletedAt),
      ),
    );
  return m ?? null;
}

/**
 * Edit a profile (spec F1–F3): the person themselves or member.edit_profile. Strict input,
 * one transaction, one audit row listing what changed (private values as "[redacted]").
 */
export async function updateProfile(ctx: PeopleCtx, personId: string, raw: ProfileInput) {
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid profile",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  const patch = parsed.data;
  const resource = await personResource(ctx.db, ctx.edition, personId);
  if (!resource || !can(ctx.actor, "member.edit_profile", resource)) throw new ForbiddenError();
  const now = ctx.now ?? new Date();

  return inTx(ctx.db, async (tx) => {
    const person = firstRow(await tx.select().from(people).where(eq(people.id, personId)));
    const member = await memberRow(tx, ctx.edition.id, personId);
    const changes: Record<string, [unknown, unknown]> = {};
    const note = (field: string, before: unknown, after: unknown) => {
      if (same(before, after)) return;
      changes[field] = REDACTED_FIELDS.has(field)
        ? ["[redacted]", "[redacted]"]
        : [iso(before) ?? null, iso(after) ?? null];
    };

    const personSet: Record<string, unknown> = {};
    for (const [field, column] of Object.entries(PERSON_FIELDS)) {
      if (!(field in patch)) continue;
      const value = patch[field as keyof typeof patch];
      note(field, person[column], value);
      personSet[column] = value;
    }
    const memberSet: Record<string, unknown> = {};
    for (const [field, column] of Object.entries(MEMBER_FIELDS)) {
      if (!(field in patch)) continue;
      const value = patch[field as keyof typeof patch];
      if (!member) throw new ValidationError(`No ${ctx.edition.year} member record for ${field}`);
      note(field, member[column], value);
      memberSet[column] = value;
    }
    const arrival = "arrivalAt" in patch ? patch.arrivalAt : member?.arrivalAt;
    const departure = "departureAt" in patch ? patch.departureAt : member?.departureAt;
    if (arrival && departure && departure < arrival) {
      throw new ValidationError("Departure can't be before arrival", [
        { path: "departureAt", message: "Departure can't be before arrival" },
      ]);
    }

    if (Object.keys(personSet).length) {
      await tx
        .update(people)
        .set({ ...personSet, updatedAt: now })
        .where(eq(people.id, personId));
    }
    if (member && Object.keys(memberSet).length) {
      await tx
        .update(editionMembers)
        .set({ ...memberSet, updatedAt: now })
        .where(eq(editionMembers.id, member.id));
    }

    if (patch.skills) {
      const keys = [...new Set(patch.skills)];
      const found = keys.length
        ? await tx.select().from(skills).where(inArray(skills.key, keys))
        : [];
      const unknown = keys.filter((k) => !found.some((s) => s.key === k));
      if (unknown.length) throw new ValidationError(`Unknown skill: ${unknown.join(", ")}`);
      const before = await tx
        .select({ key: skills.key })
        .from(personSkills)
        .innerJoin(skills, eq(skills.id, personSkills.skillId))
        .where(eq(personSkills.personId, personId));
      note("skills", before.map((s) => s.key).sort(), [...keys].sort());
      await tx.delete(personSkills).where(eq(personSkills.personId, personId));
      if (found.length) {
        await tx.insert(personSkills).values(found.map((s) => ({ personId, skillId: s.id })));
      }
    }

    if (patch.availabilityWindows) {
      if (!member) throw new ValidationError(`No ${ctx.edition.year} member record`);
      for (const w of patch.availabilityWindows) {
        if (w.endsOn < w.startsOn)
          throw new ValidationError("An availability window ends before it starts");
      }
      await tx
        .delete(availabilityWindows)
        .where(eq(availabilityWindows.editionMemberId, member.id));
      if (patch.availabilityWindows.length) {
        await tx.insert(availabilityWindows).values(
          patch.availabilityWindows.map((w) => ({
            editionMemberId: member.id,
            startsOn: w.startsOn,
            endsOn: w.endsOn,
            kind: w.kind,
            note: w.note ?? null,
          })),
        );
      }
      changes.availabilityWindows = ["(replaced)", patch.availabilityWindows.length];
    }

    if (Object.keys(changes).length) {
      await recordAudit(
        tx,
        { actor: ctx.actor, editionId: ctx.edition.id },
        {
          action: "member.profile_updated",
          entity: { type: "base.person", id: personId },
          changes,
        },
      );
    }
    return { changed: Object.keys(changes) };
  });
}

/** How many live confirmed members this edition has, and its capacity setting. */
export async function capacityStatus(db: DbOrTx, editionId: string) {
  const [ed] = await db
    .select({ capacity: editions.memberCapacity })
    .from(editions)
    .where(eq(editions.id, editionId));
  const [row] = await db
    .select({ n: count() })
    .from(editionMembers)
    .where(
      and(
        eq(editionMembers.editionId, editionId),
        eq(editionMembers.status, "confirmed"),
        isNull(editionMembers.deletedAt),
      ),
    );
  return { confirmed: row?.n ?? 0, capacity: ed?.capacity ?? null };
}

/** Change someone's status this edition (spec M1, M2). Confirming stops at capacity. */
export async function setMemberStatus(ctx: PeopleCtx, personId: string, status: MemberStatus) {
  if (!can(ctx.actor, "member.manage")) throw new ForbiddenError();
  const resource = await personResource(ctx.db, ctx.edition, personId);
  if (!resource) throw new ForbiddenError();
  const now = ctx.now ?? new Date();
  return inTx(ctx.db, async (tx) => {
    const member = await memberRow(tx, ctx.edition.id, personId);
    const before = member?.status ?? null;
    if (before === status) return { changed: false };
    if (status === "confirmed") {
      const { confirmed, capacity } = await capacityStatus(tx, ctx.edition.id);
      if (capacity !== null && confirmed >= capacity) {
        throw new ValidationError(`Member capacity reached (${capacity}). Raise it first.`);
      }
    }
    if (member) {
      await tx
        .update(editionMembers)
        .set({ status, updatedAt: now })
        .where(and(eq(editionMembers.id, member.id), ne(editionMembers.status, status)));
    } else {
      await tx.insert(editionMembers).values({ editionId: ctx.edition.id, personId, status });
    }
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "member.status_changed",
        entity: { type: "base.person", id: personId },
        changes: { status: [before, status] },
        significance: "significant",
      },
    );
    return { changed: true };
  });
}

/** Admin-only note on this year's member record (spec M3). */
export async function addAdminNote(ctx: PeopleCtx, personId: string, body: string) {
  if (!can(ctx.actor, "member.admin_notes")) throw new ForbiddenError();
  const text = body.trim();
  if (!text || text.length > 2000) throw new ValidationError("A note is 1 to 2000 characters");
  const member = await memberRow(ctx.db, ctx.edition.id, personId);
  if (!member) throw new ForbiddenError();
  return inTx(ctx.db, async (tx) => {
    const note = firstRow(
      await tx
        .insert(memberAdminNotes)
        .values({ editionMemberId: member.id, authorPersonId: ctx.actor.personId, body: text })
        .returning({ id: memberAdminNotes.id }),
    );
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "member.admin_note_added",
        entity: { type: "base.admin_note", id: note.id },
        changes: { personId: [null, personId] },
      },
    );
    return note;
  });
}
