import { and, asc, eq, gte, inArray, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ReadOnlyDb } from "@/base/api";
import { anchorDates, people, personSkills, skills } from "@/base/api/schema";
import { instantToCampInput } from "@/lib/dates";
import { contribution } from "../rules/contribution";
import { SIGNUPS_OPEN_ANCHOR } from "../rules/opening";
import {
  shiftsDutyTypes as dt,
  shiftsChecklistItems,
  shiftsChecklistTicks,
  shiftsPrecredits,
  shiftsSettings,
  shiftsStandby,
  shiftsSlots as sl,
  shiftsSignups as su,
} from "../schema";

const DEAD = ["released", "swapped_out"] as const;

export async function settingsOf(db: ReadOnlyDb, editionId: string) {
  const [s] = await db.select().from(shiftsSettings).where(eq(shiftsSettings.editionId, editionId));
  return s ?? null;
}

/** When shift sign-ups open this edition (anchor date), or null when nobody has set it. */
export async function signupsOpenAt(db: ReadOnlyDb, editionId: string) {
  const [a] = await db
    .select({ at: anchorDates.startsAt })
    .from(anchorDates)
    .where(and(eq(anchorDates.editionId, editionId), eq(anchorDates.key, SIGNUPS_OPEN_ANCHOR)));
  return a?.at ?? null;
}

export async function mySkillIds(db: ReadOnlyDb, personId: string) {
  const rows = await db
    .select({ id: personSkills.skillId })
    .from(personSkills)
    .where(eq(personSkills.personId, personId));
  return rows.map((r) => r.id);
}

/** Every shift this year with its duty, staffing and how many are on it. */
export async function slotsOf(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      id: sl.id,
      startsAt: sl.startsAt,
      endsAt: sl.endsAt,
      status: sl.status,
      dutyName: dt.name,
      dutyKey: dt.key,
      category: dt.category,
      phase: dt.phase,
      isSpecialist: dt.isSpecialist,
      requiredSkillId: dt.requiredSkillId,
      skillLabel: skills.label,
      minStaff: sql<number>`coalesce(${sl.minStaff}, ${dt.minStaff})`.mapWith(Number),
      maxStaff: sql<number>`coalesce(${sl.maxStaff}, ${dt.maxStaff})`.mapWith(Number),
      liveCount:
        sql<number>`(select count(*) from ${su} where ${su.slotId} = ${sl.id} and ${su.status} not in ('released', 'swapped_out'))`.mapWith(
          Number,
        ),
    })
    .from(sl)
    .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
    .leftJoin(skills, eq(skills.id, dt.requiredSkillId))
    .where(and(eq(sl.editionId, editionId), notInArray(sl.status, ["cancelled"])))
    .orderBy(asc(sl.startsAt), asc(dt.name));
}

/** My live shifts this year (with phase), for contribution and overlaps. */
export async function myShifts(db: ReadOnlyDb, editionId: string, personId: string) {
  return db
    .select({
      signupId: su.id,
      slotId: sl.id,
      status: su.status,
      startsAt: sl.startsAt,
      endsAt: sl.endsAt,
      phase: dt.phase,
      dutyName: dt.name,
    })
    .from(su)
    .innerJoin(sl, eq(sl.id, su.slotId))
    .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
    .where(
      and(eq(sl.editionId, editionId), eq(su.personId, personId), notInArray(su.status, [...DEAD])),
    )
    .orderBy(asc(sl.startsAt));
}

export async function myContribution(db: ReadOnlyDb, editionId: string, personId: string) {
  const [settings, shifts, credits] = await Promise.all([
    settingsOf(db, editionId),
    myShifts(db, editionId, personId),
    db
      .select({ hours: shiftsPrecredits.hours })
      .from(shiftsPrecredits)
      .where(
        and(eq(shiftsPrecredits.editionId, editionId), eq(shiftsPrecredits.personId, personId)),
      ),
  ]);
  if (!settings) return null;
  return contribution(
    shifts,
    settings,
    credits.reduce((a, c) => a + c.hours, 0),
    (d) => instantToCampInput(d).date,
  );
}

/** One shift: duty details, who's on it, its checklist and what's ticked. */
export async function shiftCard(db: ReadOnlyDb, editionId: string, slotId: string) {
  const [slot] = (await slotsOf(db, editionId)).filter((s) => s.id === slotId);
  if (!slot) return null;
  const [duty] = await db
    .select({
      id: dt.id,
      description: dt.description,
      needsHandover: dt.needsHandover,
      leadName: people.displayName,
    })
    .from(sl)
    .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
    .leftJoin(people, eq(people.id, dt.leadPersonId))
    .where(eq(sl.id, slotId));
  const [crew, items, ticks] = await Promise.all([
    db
      .select({ personId: su.personId, name: people.displayName, status: su.status })
      .from(su)
      .innerJoin(people, eq(people.id, su.personId))
      .where(and(eq(su.slotId, slotId), notInArray(su.status, [...DEAD])))
      .orderBy(asc(people.displayName)),
    db
      .select()
      .from(shiftsChecklistItems)
      .where(eq(shiftsChecklistItems.dutyTypeId, duty?.id ?? ""))
      .orderBy(asc(shiftsChecklistItems.section), asc(shiftsChecklistItems.position)),
    db
      .select({ itemId: shiftsChecklistTicks.checklistItemId })
      .from(shiftsChecklistTicks)
      .where(eq(shiftsChecklistTicks.slotId, slotId)),
  ]);
  const ticked = new Set(ticks.map((t) => t.itemId));
  return {
    slot,
    duty,
    crew,
    checklist: items.map((i) => ({ ...i, ticked: ticked.has(i.id) })),
  };
}

/** Cover taken on the paper HELP sheet and recorded by a lead: the app's copy of the wall. */
export async function helpWall(db: ReadOnlyDb, editionId: string) {
  return db
    .select({
      signupId: su.id,
      startsAt: sl.startsAt,
      dutyName: dt.name,
      takenBy: people.displayName,
    })
    .from(su)
    .innerJoin(sl, eq(sl.id, su.slotId))
    .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
    .innerJoin(people, eq(people.id, su.personId))
    .where(and(eq(sl.editionId, editionId), eq(su.source, "help_sheet")))
    .orderBy(asc(sl.startsAt));
}

/** Who leads each duty this year (names only), for "who to find" at camp. */
export async function dutyLeads(db: ReadOnlyDb, editionId: string) {
  return db
    .selectDistinct({ duty: dt.name, lead: people.displayName })
    .from(dt)
    .innerJoin(people, eq(people.id, dt.leadPersonId))
    .where(eq(dt.editionId, editionId))
    .orderBy(asc(dt.name));
}

/** Standby rows that matter now: open offers, waiting people, and places taken in the last 3 days. */
export async function standbyActivity(db: ReadOnlyDb, editionId: string, now: Date) {
  const since = new Date(now.getTime() - 3 * 86_400_000);
  const dropper = alias(people, "dropper");
  return db
    .select({
      id: shiftsStandby.id,
      slotId: shiftsStandby.slotId,
      personId: shiftsStandby.personId,
      status: shiftsStandby.status,
      createdAt: shiftsStandby.createdAt,
      decidedAt: shiftsStandby.decidedAt,
      name: people.displayName,
      droppedByName: dropper.displayName,
      dutyName: dt.name,
      leadPersonId: dt.leadPersonId,
      startsAt: sl.startsAt,
      endsAt: sl.endsAt,
    })
    .from(shiftsStandby)
    .innerJoin(sl, eq(sl.id, shiftsStandby.slotId))
    .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
    .innerJoin(people, eq(people.id, shiftsStandby.personId))
    .leftJoin(dropper, eq(dropper.id, shiftsStandby.droppedByPersonId))
    .where(
      and(
        eq(sl.editionId, editionId),
        or(
          inArray(shiftsStandby.status, ["waiting", "offered"]),
          and(eq(shiftsStandby.status, "took"), gte(shiftsStandby.decidedAt, since)),
        ),
      ),
    )
    .orderBy(asc(shiftsStandby.createdAt));
}
