// B1 seed: ~100 obviously fake members, 11 leads and co-leads, roles, skills and profile data.
// Deterministic (fixed PRNG seed) and idempotent (every insert is on-conflict-do-nothing).
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../src/base/db/client";
import {
  anchorDates,
  editionMembers,
  people,
  personSkills,
  roleAssignments,
  roles,
  skills,
  teamMemberships,
  teams,
} from "../src/base/schema";

const FIRST = [
  "Alex",
  "Sam",
  "Jordan",
  "Casey",
  "Robin",
  "Morgan",
  "Taylor",
  "Jamie",
  "Riley",
  "Quinn",
];
const LAST = [
  "Example",
  "Sample",
  "Placeholder",
  "Testperson",
  "Demo",
  "Fakename",
  "Mockley",
  "Dummyson",
  "Specimen",
  "Prototype",
];
const PLAYA = [
  "Sprocket",
  "Dusty",
  "Glitter",
  "Moonbeam",
  "Wrench",
  "Pixel",
  "Sparkplug",
  "Nomad",
  "Tumbleweed",
  "Disco",
  "Gecko",
  "Zephyr",
];

export const SKILLS = [
  ["carpentry", "Carpentry", false],
  ["electrical", "Electrical", false],
  ["welding", "Welding", false],
  ["rigging", "Rigging and heights", false],
  ["tractor_driver", "Tractor / forklift driver", true],
  ["driving_4x4", "4x4 and trailer driving", false],
  ["sound_engineering", "Sound engineering", false],
  ["lighting_dmx", "Lighting / DMX", false],
  ["photography", "Photography", false],
  ["first_aid", "First aid", true],
  ["cooking_large_batch", "Cooking for crowds", false],
  ["sewing", "Sewing and fabric", false],
] as const;

/** Leads (11) and officer roles. Index = position in the fake-name list. */
const LEADS: [number, string, "lead" | "co_lead"][] = [
  [0, "camp_infra", "lead"],
  [1, "gift_projects", "co_lead"],
  [2, "logistics", "lead"],
  [3, "finance", "lead"],
  [4, "kitchen", "lead"],
  [5, "kitchen", "co_lead"],
  [6, "programming", "lead"],
  [7, "community", "lead"],
  [8, "duties", "lead"],
  [9, "moop", "lead"],
  [10, "marketing", "lead"],
];
const ROLES: [number, string][] = [
  [11, "camp_lead"],
  [3, "finance_approver"],
  [4, "kitchen_sensitive_viewer"],
  [5, "kitchen_sensitive_viewer"],
  [9, "lnt_lead"],
  [12, "fire_safety_officer"],
  [6, "sound_officer"],
  [2, "mv_dmv_contact"],
  // P8 example: Robin Placeholder (index 24) holds two roles and is on three teams.
  [24, "safety_officer"],
  [24, "information_officer"],
];

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fakePeople() {
  const r = rng(2027);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  return LAST.flatMap((last, li) =>
    FIRST.map((first, fi) => {
      const i = li * 10 + fi;
      const day = 17 + Math.floor(r() * 9); // arrive 17–25 April 2027
      const status =
        i < 67 ? "confirmed" : i < 85 ? "waitlisted" : i < 93 ? "prospect" : "withdrawn";
      return {
        i,
        email: `${first}.${last}@example.test`.toLowerCase(),
        first,
        last,
        playa: r() < 0.6 ? `${pick(PLAYA)} ${i}` : null,
        phone: `+2782555${String(1000 + i)}`,
        country: pick(["ZA", "ZA", "ZA", "ZA", "DE", "NL", "GB", "US"] as const),
        status,
        payment:
          status === "confirmed"
            ? pick(["deposit_paid", "paid_in_full", "paid_in_full", "unknown"] as const)
            : "unknown",
        arrivalAt: new Date(Date.UTC(2027, 3, day, 8 + Math.floor(r() * 8))),
        departureAt: new Date(Date.UTC(2027, 4, 2 + Math.floor(r() * 4), 10)),
        build: day <= 21 ? "full" : pick(["none", "partial"] as const),
        strike: pick(["none", "partial", "full"] as const),
        tent: pick(["camp_dome", "large_bell", "byo_tent", "caravan_or_car", "undecided"] as const),
        diet: pick([
          "omnivore",
          "omnivore",
          "omnivore",
          "vegetarian",
          "vegan",
          "pescatarian",
        ] as const),
        allergies:
          r() < 0.15
            ? pick(["peanuts", "shellfish", "gluten (coeliac)", "lactose", "sesame"] as const)
            : null,
        skills: [...new Set([pick(SKILLS)[0], pick(SKILLS)[0]])].slice(0, 1 + Math.floor(r() * 2)),
        teams: [
          pick([
            "camp_infra",
            "gift_projects",
            "logistics",
            "kitchen",
            "duties",
            "moop",
            "content",
          ] as const),
        ],
      } as const;
    }),
  );
}

export async function seedPeople(db: Db, editionId: string) {
  await db
    .insert(skills)
    .values(SKILLS.map(([key, label, isQualification]) => ({ key, label, isQualification })))
    .onConflictDoNothing();
  await db
    .insert(anchorDates)
    .values(
      [
        ["shift_signups_open", "Shift sign-ups open", "2027-02-01T08:00:00Z"],
        ["container_day", "Container Day", "2027-04-17T06:00:00Z"],
        ["build_start", "Build starts", "2027-04-21T06:00:00Z"],
        ["event_start", "AfrikaBurn opens", "2027-04-26T10:00:00Z"],
        ["event_end", "AfrikaBurn ends", "2027-05-02T12:00:00Z"],
        ["strike_end", "Strike done", "2027-05-05T12:00:00Z"],
      ].map(([key, label, at]) => ({
        editionId,
        key: key ?? "",
        label: label ?? "",
        startsAt: new Date(at ?? ""),
        sourceNote: "placeholder (fake seed date)",
      })),
    )
    .onConflictDoNothing();

  const list = fakePeople();
  await db
    .insert(people)
    .values(
      list.map((p) => ({
        email: p.email,
        displayName: `${p.first} ${p.last}`,
        legalFirstName: p.first,
        legalLastName: p.last,
        playaName: p.playa,
        phoneE164: p.phone,
        countryCode: p.country,
        directoryVisibility:
          p.i % 9 === 0 ? ("members_with_contact" as const) : ("members" as const),
      })),
    )
    .onConflictDoNothing();
  const rows = await db
    .select({ id: people.id, email: people.email })
    .from(people)
    .where(
      inArray(
        people.email,
        list.map((p) => p.email),
      ),
    );
  const idOf = new Map(rows.map((r) => [r.email, r.id]));
  const id = (i: number) => idOf.get(list[i]?.email ?? "") ?? "";

  await db
    .insert(editionMembers)
    .values(
      list.map((p) => ({
        editionId,
        personId: id(p.i),
        status: p.status,
        paymentStatus: p.payment,
        arrivalAt: p.arrivalAt,
        departureAt: p.departureAt,
        buildCommitment: p.build,
        strikeCommitment: p.strike,
        tentChoice: p.tent,
        diet: p.diet,
        allergies: p.allergies,
        importSource: "seed (fake)",
      })),
    )
    .onConflictDoNothing();

  const skillRows = await db.select().from(skills);
  const skillId = new Map(skillRows.map((s) => [s.key, s.id]));
  await db
    .insert(personSkills)
    .values(
      list.flatMap((p) =>
        p.skills.map((k) => ({ personId: id(p.i), skillId: skillId.get(k) ?? "" })),
      ),
    )
    .onConflictDoNothing();

  const teamRows = await db.select().from(teams).where(eq(teams.editionId, editionId));
  const teamId = new Map(teamRows.map((t) => [t.key, t.id]));
  // Leads first: on a clash with a random pick, the lead row wins (inserts never overwrite).
  const memberships = [
    ...LEADS.map(([i, key, role]) => ({ teamId: teamId.get(key) ?? "", personId: id(i), role })),
    ...["kitchen", "moop", "duties"].map((key) => ({
      teamId: teamId.get(key) ?? "",
      personId: id(24),
      role: "member" as const,
    })),
    ...list
      .filter((p) => p.status === "confirmed" && p.i !== 24)
      .flatMap((p) =>
        p.teams.map((key) => ({
          teamId: teamId.get(key) ?? "",
          personId: id(p.i),
          role: "member" as const,
        })),
      ),
  ];
  for (const m of memberships) await db.insert(teamMemberships).values(m).onConflictDoNothing();

  const roleRows = await db.select().from(roles);
  const roleId = new Map(roleRows.map((r) => [r.key, r.id]));
  await db
    .insert(roleAssignments)
    .values(
      ROLES.map(([i, key]) => ({ editionId, personId: id(i), roleId: roleId.get(key) ?? "" })),
    )
    .onConflictDoNothing();
  return { people: list.length };
}
