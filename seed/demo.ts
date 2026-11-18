// pnpm seed:demo — idempotent rich FAKE data for demo mode (docs/specs/b3-demo-mode.md):
// the five personas, Kitchen and Gift projects with late / blocked / done tasks, a pending
// helper offer and unread notifications. Run after `pnpm seed`. Refuses non-local databases.
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { loadEnv } from "../scripts/lib/load-env";
import { closeDb, getDb } from "../src/base/db/client";
import { seedPersonas } from "../src/base/demo/seed-personas";
import { claimTask, setClaimMode } from "../src/base/engine/claims";
import { notify } from "../src/base/engine/notify";
import { createProject } from "../src/base/engine/projects";
import { createTask, updateTask } from "../src/base/engine/tasks";
import { loadActorForPerson } from "../src/base/people/actor-loader";
import { registerModules } from "../src/base/registry/runtime";
import {
  notifications,
  projects,
  tasks,
  teamNoticeReads,
  teamNotices,
  teams,
} from "../src/base/schema";
import { demoDoneTopUp } from "../src/lib/fun-extras";
import { modules } from "../src/modules";

loadEnv();
registerModules(modules);
if (/neon\.tech/.test(process.env.DATABASE_URL ?? "") && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    "Refusing to seed demo data into a Neon database (set SEED_ALLOW_REMOTE=1 for a preview).",
  );
  process.exit(1);
}

const SEED_EDITION = { id: "01900000-0000-7000-8000-000000002027", year: 2027 };
const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  // One transaction: a failed run leaves nothing half-seeded.
  await getDb().transaction(seedAll);
}

async function seedAll(db: Db) {
  const edition = SEED_EDITION;
  const ids = await seedPersonas(db, edition.id);
  const ctxOf = async (personId: string) => {
    const actor = await loadActorForPerson(db, personId, edition);
    if (!actor) throw new Error("persona missing");
    return { db, actor, edition };
  };
  const team = async (key: string) =>
    (
      await db
        .select()
        .from(teams)
        .where(and(eq(teams.editionId, edition.id), eq(teams.key, key)))
    )[0];
  const kitchen = await team("kitchen");
  if (!kitchen) throw new Error("Run `pnpm seed` first");
  const [already] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.teamId, kitchen.id), eq(projects.name, "Meal plan (demo)")));
  if (already) console.log("Demo data already there.");
  else await seedRich(db, ids, ctxOf, kitchen.id);
  await trimMemberDemo(db, ids);
  await topUpSamDone(db, ids);
  await seedNotices(db, ids, kitchen.id);
}

/** Two Kitchen team notices from Alex: one showing now, one that ended and Sam read. */
async function seedNotices(db: Db, ids: Ids, kitchenId: string) {
  const sixPm = (days: number) => {
    const d = inDays(days);
    d.setUTCHours(16, 0, 0, 0); // 18:00 camp time
    return d;
  };
  const samples = [
    {
      body: "Container loading at the Cape Town storage unit, Saturday 8am. Bring gloves and water.",
      createdAt: inDays(-1),
      endsAt: sixPm(21),
      readBy: [] as string[],
    },
    {
      body: "Kitchen meeting moved to Thursday 7pm on the usual video link.",
      createdAt: inDays(-9),
      endsAt: sixPm(-6),
      readBy: [ids.member],
    },
  ];
  for (const n of samples) {
    const [have] = await db
      .select({ id: teamNotices.id })
      .from(teamNotices)
      .where(and(eq(teamNotices.teamId, kitchenId), eq(teamNotices.body, n.body)));
    if (have) continue;
    const [row] = await db
      .insert(teamNotices)
      .values({
        teamId: kitchenId,
        authorPersonId: ids.kitchen_lead,
        body: n.body,
        endsAt: n.endsAt,
        createdAt: n.createdAt,
        updatedAt: n.createdAt,
      })
      .returning({ id: teamNotices.id });
    for (const personId of n.readBy)
      if (row)
        await db
          .insert(teamNoticeReads)
          .values({ noticeId: row.id, personId, readAt: new Date(n.createdAt.getTime() + DAY) })
          .onConflictDoNothing();
  }
}

type Db = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Ids = Awaited<ReturnType<typeof seedPersonas>>;

async function seedRich(
  db: Db,
  ids: Ids,
  ctxOf: (personId: string) => Promise<Parameters<typeof createProject>[0]>,
  kitchenId: string,
) {
  const lead = await ctxOf(ids.kitchen_lead);
  const plan: [
    string,
    [string, number, string, "todo" | "blocked" | "done" | "in_progress", string?][],
  ][] = [
    [
      "Meal plan (demo)",
      [
        ["Draft dietary summary", -3, "diet_viewer", "todo"],
        ["Shopping list v1", 12, "kitchen_lead", "blocked", "waiting on headcount"],
        ["Pack personal water (20 L)", 21, "member", "todo"],
        ["Confirm menu with camp", -10, "kitchen_lead", "done"],
        ["Order spices", -6, "member", "done"],
      ],
    ],
    [
      "Kitchen kit (demo)",
      [
        ["Source 2nd gas burner", -8, "kitchen_lead", "in_progress"],
        ["Buy shade-net clips", -2, "member", "todo"],
        ["Cold-chain plan", 7, "diet_viewer", "blocked", "waiting on generator spec"],
        ["Set up kitchen gazebo", 3, "kitchen_lead", "todo"],
        ["Clean big pots", -14, "member", "done"],
      ],
    ],
    [
      "Water & ice (demo)",
      [
        ["Book ice truck", 15, "kitchen_lead", "done"],
        ["Water tank check", 5, "member", "done"],
        ["Ice rota", 30, "kitchen_lead", "todo"],
      ],
    ],
  ];
  const created: Record<string, string> = {};
  for (const [name, list] of plan) {
    const project = await createProject(lead, { teamId: kitchenId, name });
    for (const [title, due, owner, status, why] of list) {
      const t = await createTask(lead, {
        projectId: project.id,
        title,
        dueAt: inDays(due),
        ownerPersonId: ids[owner as keyof typeof ids],
      });
      created[title] = t.id;
      if (status !== "todo") await updateTask(lead, t.id, { status, blockedReason: why ?? null });
    }
  }
  const gazebo = created["Set up kitchen gazebo"] ?? "";
  await setClaimMode(lead, gazebo, { claimMode: "open_with_approval", claimCapacity: 3 });
  await claimTask(await ctxOf(ids.member), gazebo);

  const tell = (to: string, title: string, task: string) =>
    notify(db, {
      recipientPersonId: to,
      type: "task.assigned",
      entityType: "base.task",
      entityId: created[task] ?? gazebo,
      title,
      href: `/tasks/${created[task] ?? gazebo}`,
    });
  await tell(ids.member, "Kitchen lead posted the meal plan draft", "Shopping list v1");
  await tell(ids.member, "Reminder: “Buy shade-net clips” is late", "Buy shade-net clips");
  await tell(ids.member, "Jo commented on “Cold-chain plan”", "Cold-chain plan");
  await tell(
    ids.kitchen_lead,
    "Escalation: “Source 2nd gas burner” is 7+ days late",
    "Source 2nd gas burner",
  );
  await tell(
    ids.kitchen_lead,
    "Sam offered to help on “Set up kitchen gazebo”",
    "Set up kitchen gazebo",
  );
  await tell(ids.diet_viewer, "You own “Draft dietary summary”", "Draft dietary summary");
  console.log("Seeded demo projects, tasks, a helper offer and notifications (all fake).");
}

// Sam (member) is the first demo most people click: keep the list short and believable,
// ~5 open to-dos (exactly one late) and ~4 unread alerts (Ruchir, Oct 25). Runs on every
// seed:demo so it also tidies an already-seeded demo database. Fake data only.
const SAM_KEEP_TASKS = [
  "Buy shade-net clips",
  "Pack personal water (20 L)",
  "Sound plan and Sound Officer",
  "OEA-SR-001: buy “Gas bottles (4 × 9 kg)” and add the receipt",
  "OEA-SR-002: buy “Ice for build week” and add the receipt",
];
const SAM_HANDOFF: Record<string, "admin" | "kitchen_lead"> = {
  "Tell AfrikaBurn we're coming back (intent form)": "admin",
  "Ice rota": "kitchen_lead",
};
const SAM_KEEP_ALERTS = [
  "Reminder: “Buy shade-net clips” is late",
  "Kitchen lead posted the meal plan draft",
  "Jo commented on “Cold-chain plan”",
  "Assigned to you: OEA-SR-001: buy “Gas bottles (4 × 9 kg)” and add the receipt",
];

async function trimMemberDemo(db: Db, ids: Ids) {
  const sam = ids.member;
  const open = and(
    eq(tasks.ownerPersonId, sam),
    inArray(tasks.status, ["todo", "in_progress", "blocked"]),
  );
  for (const [title, to] of Object.entries(SAM_HANDOFF)) {
    await db
      .update(tasks)
      .set({ ownerPersonId: ids[to] })
      .where(and(open, eq(tasks.title, title)));
  }
  // Anything else still open on Sam (e.g. requests made while click-testing the demo).
  await db
    .update(tasks)
    .set({ status: "cancelled" })
    .where(and(open, notInArray(tasks.title, SAM_KEEP_TASKS)));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientPersonId, sam),
        isNull(notifications.readAt),
        notInArray(notifications.title, SAM_KEEP_ALERTS),
      ),
    );
  console.log("Trimmed Sam's demo to-dos and alerts.");
}

/** Sam gets 9 finished tasks, so finishing one more shows the 10-task campfire (fake data). */
async function topUpSamDone(db: Db, ids: Ids) {
  const mine = await db
    .select({ status: tasks.status, editionId: tasks.editionId, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.ownerPersonId, ids.member), isNull(tasks.deletedAt)));
  const add = demoDoneTopUp(mine.filter((t) => t.status === "done").length);
  const base = mine[0];
  if (!base || add === 0) return;
  await db.insert(tasks).values(
    Array.from({ length: add }, (_, i) => ({
      editionId: base.editionId,
      projectId: base.projectId,
      title: `Earlier camp job (demo) ${i + 1}`,
      status: "done" as const,
      ownerPersonId: ids.member,
      completedAt: inDays(-20 - i),
    })),
  );
  console.log(`Gave Sam ${add} more finished demo tasks.`);
}

await main();
await closeDb();
