import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Actor } from "../authz/actor";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import { ForbiddenError } from "../errors";
import {
  availabilityWindows,
  editionMembers,
  memberAdminNotes,
  people,
  personSkills,
  skills,
} from "../schema";
import { type TeamRef, teamsByPerson } from "./resources";

export interface PeopleCtx {
  db: DbOrTx;
  actor: Actor;
  edition: EditionRef;
  now?: Date;
}

export interface DirectoryEntry {
  personId: string;
  displayName: string;
  playaName: string | null;
  countryCode: string | null;
  teams: TeamRef[];
  skills: string[];
  /** Only when the caller may see this person's contacts. */
  contact: { email: string; phone: string | null } | null;
  /** Only for member.manage. */
  status: string | null;
}

async function skillsByPerson(db: DbOrTx, personIds: string[]) {
  const out = new Map<string, string[]>();
  if (!personIds.length) return out;
  const rows = await db
    .select({ personId: personSkills.personId, label: skills.label })
    .from(personSkills)
    .innerJoin(skills, eq(skills.id, personSkills.skillId))
    .where(inArray(personSkills.personId, personIds))
    .orderBy(asc(skills.label));
  for (const r of rows) out.set(r.personId, [...(out.get(r.personId) ?? []), r.label]);
  return out;
}

/**
 * The directory (spec P1, P5): confirmed members by default; `allStatuses` only for
 * member.manage. Each row is filtered on the server by what the caller may see.
 */
export async function listDirectory(
  ctx: PeopleCtx,
  opts: { allStatuses?: boolean } = {},
): Promise<DirectoryEntry[]> {
  const { db, actor, edition } = ctx;
  if (!can(actor, "member.view_directory")) throw new ForbiddenError();
  const manage = can(actor, "member.manage");
  const rows = await db
    .select({
      personId: people.id,
      displayName: people.displayName,
      playaName: people.playaName,
      countryCode: people.countryCode,
      email: people.email,
      phone: people.phoneE164,
      visibility: people.directoryVisibility,
      status: editionMembers.status,
    })
    .from(editionMembers)
    .innerJoin(people, eq(people.id, editionMembers.personId))
    .where(
      and(
        eq(editionMembers.editionId, edition.id),
        isNull(editionMembers.deletedAt),
        isNull(people.deletedAt),
        manage && opts.allStatuses ? undefined : eq(editionMembers.status, "confirmed"),
      ),
    )
    .orderBy(asc(people.displayName));
  const personIds = rows.map((r) => r.personId);
  const [teamMap, skillMap] = await Promise.all([
    teamsByPerson(db, edition, personIds),
    skillsByPerson(db, personIds),
  ]);
  const out: DirectoryEntry[] = [];
  for (const r of rows) {
    const teamList = teamMap.get(r.personId) ?? [];
    const resource = {
      personId: r.personId,
      visibility: r.visibility,
      teamIds: teamList.map((t) => t.id),
    };
    if (!can(actor, "member.view_directory", resource)) continue;
    out.push({
      personId: r.personId,
      displayName: r.displayName,
      playaName: r.playaName,
      countryCode: r.countryCode,
      teams: teamList,
      skills: skillMap.get(r.personId) ?? [],
      contact: can(actor, "member.view_contacts", resource)
        ? { email: r.email, phone: r.phone }
        : null,
      status: manage ? r.status : null,
    });
  }
  return out;
}

export type PersonView = Awaited<ReturnType<typeof getPersonView>>;

/**
 * One person's page. Every private group is null unless the caller holds the capability
 * for this person (spec P2–P4, M3). A hidden or missing person is Forbidden (404 in the UI).
 */
export async function getPersonView(ctx: PeopleCtx, personId: string) {
  const { db, actor, edition } = ctx;
  const [p] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), isNull(people.deletedAt)));
  if (!p) throw new ForbiddenError();
  const teamList = (await teamsByPerson(db, edition, [personId])).get(personId) ?? [];
  const resource = {
    personId,
    visibility: p.directoryVisibility,
    teamIds: teamList.map((t) => t.id),
  };
  const self = actor.personId === personId;
  if (!self && !can(actor, "member.view_directory", resource)) throw new ForbiddenError();

  const [m] = await db
    .select()
    .from(editionMembers)
    .where(
      and(
        eq(editionMembers.personId, personId),
        eq(editionMembers.editionId, edition.id),
        isNull(editionMembers.deletedAt),
      ),
    );
  const windows = m
    ? await db
        .select({
          startsOn: availabilityWindows.startsOn,
          endsOn: availabilityWindows.endsOn,
          kind: availabilityWindows.kind,
          note: availabilityWindows.note,
        })
        .from(availabilityWindows)
        .where(
          and(eq(availabilityWindows.editionMemberId, m.id), isNull(availabilityWindows.deletedAt)),
        )
        .orderBy(asc(availabilityWindows.startsOn))
    : [];
  const notes =
    m && can(actor, "member.admin_notes")
      ? await db
          .select({
            id: memberAdminNotes.id,
            body: memberAdminNotes.body,
            at: memberAdminNotes.createdAt,
          })
          .from(memberAdminNotes)
          .where(
            and(eq(memberAdminNotes.editionMemberId, m.id), isNull(memberAdminNotes.deletedAt)),
          )
          .orderBy(asc(memberAdminNotes.createdAt))
      : null;

  return {
    personId,
    displayName: p.displayName,
    playaName: p.playaName,
    pronouns: p.pronouns,
    bio: p.bio,
    countryCode: p.countryCode,
    firstBurnYear: p.firstBurnYear,
    directoryVisibility: self ? p.directoryVisibility : null,
    teams: teamList,
    skills: (await skillsByPerson(db, [personId])).get(personId) ?? [],
    travel: {
      arrivalAt: m?.arrivalAt ?? null,
      departureAt: m?.departureAt ?? null,
      earlyLeaveReason: m?.earlyLeaveReason ?? null,
      buildCommitment: m?.buildCommitment ?? "none",
      strikeCommitment: m?.strikeCommitment ?? "none",
      tentChoice: m?.tentChoice ?? "undecided",
      availabilityNote: m?.availabilityNote ?? null,
    },
    availability: windows,
    status: m && (self || can(actor, "member.manage")) ? m.status : null,
    contact: can(actor, "member.view_contacts", resource)
      ? {
          email: p.email,
          phone: p.phoneE164,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
        }
      : null,
    dietary:
      m && can(actor, "member.view_dietary", resource)
        ? { diet: m.diet, allergies: m.allergies }
        : null,
    payment:
      m && can(actor, "member.view_payment", resource)
        ? { status: m.paymentStatus, syncedAt: m.paymentStatusSyncedAt }
        : null,
    adminNotes: notes,
    can: {
      edit: can(actor, "member.edit_profile", resource),
      manage: can(actor, "member.manage"),
      notes: can(actor, "member.admin_notes"),
    },
  };
}
