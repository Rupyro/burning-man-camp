// Fake, deterministic, idempotent demo shifts from Sage's Duties & Shifts guide, posters and
// schedule (18 Oct 2026). Writes only shifts tables; people and skills come from the base seed.
import { and, asc, eq, inArray, like, notInArray } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { editionMembers, people, skills } from "@/base/api/schema";
import { activeKeys } from "@/lib/active-packs";
import { campInputToInstant } from "@/lib/dates";
import {
  shiftsChecklistItems,
  shiftsDutyTypes,
  shiftsPrecredits,
  shiftsSettings,
  shiftsSignups,
  shiftsSlots,
} from "./schema";

/** Demo Burn week (Mon–Sun) and its build and strike days. Real dates come from anchor dates. */
export const DEMO_BURN = {
  start: "2027-08-30",
  freeze: "2027-08-23",
  buildDays: ["2027-08-27", "2027-08-28", "2027-08-29"],
  strikeDays: ["2027-09-07"],
};
const BURN_DAYS = ["08-30", "08-31", "09-01", "09-02", "09-03", "09-04", "09-05"].map(
  (d) => `2027-${d}`,
);
const MON_SAT = BURN_DAYS.slice(0, 6);

type Section = (typeof shiftsChecklistItems.$inferInsert)["section"];
interface DutySeed {
  key: string;
  name: string;
  category: (typeof shiftsDutyTypes.$inferInsert)["category"];
  phase?: "build" | "burn" | "strike";
  description: string;
  specialist?: boolean;
  skill?: string;
  handover?: boolean;
  staff: [min: number, max: number];
  time: [start: string, end: string];
  days: string[];
  checklist?: Partial<Record<Section, string[]>>;
}

const KITCHEN_BEFORE = [
  "Wash and sanitise hands",
  "Check with the MOOP shift if there were any issues that need addressing",
  "Check the water and washing stations are full and reset",
  "Check that the bins were emptied by the MOOP shift",
];
const KITCHEN_CLEANUP = [
  "Wash all cooking equipment used during the shift",
  "Dry and pack away immediately in the correct places",
  "Wash and wipe down all surfaces used during the shift",
  "Sweep the floor of MOOP and excess dust",
];
const KITCHEN_RESOURCES = [
  "Refill water and dispose of grey water properly",
  "Sort trash into food waste, plastic, cans, cardboard and glass",
  "Replace bin bags if needed",
];
const MOOP = {
  before: [
    "Walk the whole camp and check the kitchen, chill and tent areas",
    "Agree with your team who does which task",
  ],
  during: [
    "Wash leftover dishes and equipment so the kitchen is ready for the next shift",
    "Remove MOOP from the chill area and general camp into the correct bins",
    "Reset cushions and seating, sweep the floor",
    "Clean the fire area and the braai if used",
  ],
  resources: [
    "Sort the bins correctly and take full bins to the camp disposal point",
    "Close the food waste bin",
    "Dispose of grey water in the flo bins, never on the ground",
  ],
  final: ["Tell the kitchen shift about any issues"],
};
const ART_CAR = {
  before: [
    "Check in and agree who is on each wagon and who floats",
    "Bring your torch and know where the reflective jackets are",
    "Check structures, speakers, lights and equipment are secure",
  ],
  during: [
    "Control the number of people on your wagon",
    "Keep people off the sound and light equipment",
    "Monitor volume, equipment stability and lighting",
  ],
  final: ["Stay until the next team has fully arrived and taken over"],
};

const DUTIES: DutySeed[] = [
  {
    key: "kitchen_breakfast",
    name: "Breakfast Run",
    category: "kitchen",
    description: "Feed the camp, create a welcoming morning space and reset the kitchen.",
    handover: true,
    staff: [3, 4],
    time: ["09:00", "12:30"],
    days: MON_SAT,
    checklist: {
      before: KITCHEN_BEFORE,
      setup: ["Get water boiling early", "Fetch ice with the trolley", "Set up tea and coffee"],
      during: ["Follow the menu", "Divide tasks and keep it flowing", "Clean as you go"],
      cleanup: KITCHEN_CLEANUP,
      resources: [...KITCHEN_RESOURCES, "Refill snack baskets"],
      final: ["Quick MOOP sweep into the correct bins"],
    },
  },
  {
    key: "kitchen_dinner",
    name: "Dinner Delight",
    category: "kitchen",
    description: "Prepare dinner, keep the kitchen organised and reset it for the night.",
    handover: true,
    staff: [4, 5],
    time: ["16:30", "21:00"],
    days: MON_SAT,
    checklist: {
      before: KITCHEN_BEFORE,
      during: ["Follow the menu", "Divide tasks and keep it flowing", "Clean as you go"],
      cleanup: KITCHEN_CLEANUP,
      resources: KITCHEN_RESOURCES,
      final: ["Quick MOOP sweep into the correct bins"],
    },
  },
  {
    key: "moop_early",
    name: "Early Birds MOOP",
    category: "moop",
    description: "Clean all areas of camp before breakfast. Leave no trace.",
    staff: [2, 3],
    time: ["08:30", "09:00"],
    days: BURN_DAYS,
    checklist: MOOP,
  },
  {
    key: "moop_afternoon",
    name: "Afternoon Warriors MOOP",
    category: "moop",
    description: "Clean all areas of camp before dinner. Leave no trace.",
    staff: [2, 3],
    time: ["16:00", "16:30"],
    days: BURN_DAYS,
    checklist: MOOP,
  },
  {
    key: "art_car_crew",
    name: "Art car crew",
    category: "mutant_vehicle",
    description: "Safety and vibe on the art car: one person per wagon (3) plus a floater.",
    handover: true,
    staff: [4, 4],
    time: ["20:00", "23:59"],
    days: MON_SAT,
    checklist: ART_CAR,
  },
  {
    key: "art_car_driver",
    name: "Art car driver",
    category: "mutant_vehicle",
    description: "Authorised, trained driver. Slow, steady movement only.",
    specialist: true,
    skill: "driving_4x4",
    handover: true,
    staff: [1, 1],
    time: ["20:00", "23:59"],
    days: MON_SAT,
  },
  {
    key: "art_car_sound",
    name: "Art car sound and tech",
    category: "mutant_vehicle",
    description: "Sound and technical crew for the stationary sound stage.",
    specialist: true,
    skill: "sound_engineering",
    handover: true,
    staff: [1, 2],
    time: ["20:00", "23:59"],
    days: MON_SAT,
  },
  {
    key: "build_crew",
    name: "Build crew",
    category: "build",
    phase: "build",
    description: "Set up shade, kitchen and camp infrastructure before the Burn.",
    staff: [6, 12],
    time: ["08:00", "16:00"],
    days: DEMO_BURN.buildDays,
  },
  {
    key: "strike_crew",
    name: "Strike crew",
    category: "strike",
    phase: "strike",
    description: "Pack down camp and leave no trace.",
    staff: [8, 16],
    time: ["07:00", "15:00"],
    days: DEMO_BURN.strikeDays,
  },
];

export async function seed({ db, edition, people: demo }: ModuleSeedContext) {
  const [done] = await db
    .select({ id: shiftsSettings.editionId })
    .from(shiftsSettings)
    .where(eq(shiftsSettings.editionId, edition.id));
  if (done) return tidyMemberShifts(db, edition.id, demo.member);
  await db.insert(shiftsSettings).values({
    editionId: edition.id,
    freezeAt: campInputToInstant(DEMO_BURN.freeze, "00:00"),
  });

  const skillRows = await db
    .select({ id: skills.id, key: skills.key })
    .from(skills)
    .where(inArray(skills.key, ["driving_4x4", "sound_engineering"]));
  const skillId = (key?: string) => skillRows.find((s) => s.key === key)?.id ?? null;

  const fake = await db
    .select({ id: people.id })
    .from(people)
    .innerJoin(editionMembers, eq(editionMembers.personId, people.id))
    .where(
      and(
        eq(editionMembers.editionId, edition.id),
        eq(editionMembers.status, "confirmed"),
        like(people.email, "%.%@example.test"),
      ),
    )
    .orderBy(asc(people.email))
    .limit(30);
  const person = (i: number) => fake[i]?.id ?? demo.member;

  const slotIds: Record<string, string[]> = {};
  const on = activeKeys("shiftTemplates");
  for (const d of DUTIES.filter((x) => on.has(x.key))) {
    const [duty] = await db
      .insert(shiftsDutyTypes)
      .values({
        editionId: edition.id,
        key: d.key,
        name: d.name,
        category: d.category,
        phase: d.phase ?? "burn",
        description: d.description,
        isSpecialist: d.specialist ?? false,
        requiredSkillId: skillId(d.skill),
        leadPersonId: demo.lead,
        backupPersonId: demo.admin,
        needsHandover: d.handover ?? false,
        minStaff: d.staff[0],
        maxStaff: d.staff[1],
      })
      .returning({ id: shiftsDutyTypes.id });
    if (!duty) throw new Error(`duty ${d.key} not created`);
    const items = Object.entries(d.checklist ?? {}).flatMap(([section, lines]) =>
      (lines ?? []).map((text, position) => ({
        dutyTypeId: duty.id,
        section: section as Section,
        position,
        text,
      })),
    );
    if (items.length) await db.insert(shiftsChecklistItems).values(items);
    const slots = await db
      .insert(shiftsSlots)
      .values(
        d.days.map((day) => ({
          editionId: edition.id,
          dutyTypeId: duty.id,
          startsAt: campInputToInstant(day, d.time[0]),
          endsAt: campInputToInstant(day, d.time[1]),
        })),
      )
      .returning({ id: shiftsSlots.id });
    slotIds[d.key] = slots.map((s) => s.id);
  }

  // A few claims so open, partly-filled and filled shifts all show. Nobody is auto-assigned:
  // every row is a member's own claim in the demo story.
  const claim = (key: string, day: number, who: string[]) =>
    who.map((personId) => ({ slotId: slotIds[key]?.[day] ?? "", personId }));
  const signups = [
    ...claim("kitchen_breakfast", 0, [demo.member, person(0), person(1)]),
    ...claim("kitchen_dinner", 0, [person(2), person(3)]),
    ...claim("moop_early", 0, [person(4), person(5), person(6)]),
    ...claim("moop_afternoon", 1, [demo.member]),
    ...claim("art_car_crew", 0, [person(7), person(8), person(9), person(10)]),
    ...claim("build_crew", 0, [person(11), person(12), person(13), person(14)]),
  ];
  await db.insert(shiftsSignups).values(signups);
  const full = [slotIds.moop_early?.[0], slotIds.art_car_crew?.[0]].filter((id): id is string =>
    Boolean(id),
  );
  if (full.length)
    await db.update(shiftsSlots).set({ status: "filled" }).where(inArray(shiftsSlots.id, full));

  // Months of organising count: pre-Burn credit for a builder, granted by a lead.
  await db.insert(shiftsPrecredits).values({
    editionId: edition.id,
    personId: person(11),
    kind: "building",
    hours: 4,
    grantedByPersonId: demo.lead,
  });
}

/** Sam's seeded claims: the member persona's story (see the claims in seed above). */
const MEMBER_CLAIMS: [key: string, day: number][] = [
  ["kitchen_breakfast", 0],
  ["moop_afternoon", 1],
];

/**
 * A re-seed of a seeded demo releases shifts the member persona claimed while click-testing it,
 * so their week reads as seeded. Fake demo data only.
 */
async function tidyMemberShifts(db: ModuleSeedContext["db"], editionId: string, member: string) {
  const keep = MEMBER_CLAIMS.flatMap(([key, day]) => {
    const d = DUTIES.find((x) => x.key === key);
    const date = d?.days[day];
    return d && date ? [`${key}@${campInputToInstant(date, d.time[0]).toISOString()}`] : [];
  });
  const live = await db
    .select({ id: shiftsSignups.id, key: shiftsDutyTypes.key, startsAt: shiftsSlots.startsAt })
    .from(shiftsSignups)
    .innerJoin(shiftsSlots, eq(shiftsSlots.id, shiftsSignups.slotId))
    .innerJoin(shiftsDutyTypes, eq(shiftsDutyTypes.id, shiftsSlots.dutyTypeId))
    .where(
      and(
        eq(shiftsSlots.editionId, editionId),
        eq(shiftsSignups.personId, member),
        notInArray(shiftsSignups.status, ["released", "swapped_out"]),
      ),
    );
  const extra = live.filter((s) => !keep.includes(`${s.key}@${s.startsAt.toISOString()}`));
  if (!extra.length) return;
  await db
    .update(shiftsSignups)
    .set({ status: "released" })
    .where(
      inArray(
        shiftsSignups.id,
        extra.map((s) => s.id),
      ),
    );
  console.log(`Released ${extra.length} demo test shift claim(s) for the member persona.`);
}
