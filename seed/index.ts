// pnpm seed: deterministic, fake data only (REPO_SETUP.md §7): camp settings, editions, roles,
// teams, three demo accounts plus the demo applicant, ~100 fake members with leads, roles and
// profiles (seed/people.ts), then each module's seed.ts, then the events those seeds emitted.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { loadEnv } from "../scripts/lib/load-env";
import { runAllMigrations } from "../scripts/lib/migrate";
import { findLiveInviteForPerson } from "../src/base/auth/eligibility";
import { createInvite } from "../src/base/auth/invites";
import { Actor } from "../src/base/authz/actor";
import { closeDb, type Db, getDb } from "../src/base/db/client";
import { createModuleTasksApi } from "../src/base/engine/module-tasks";
import { dispatchEvents } from "../src/base/events/dispatch";
import { createEventsApi } from "../src/base/events/emit";
import { loadActorForPerson } from "../src/base/people/actor-loader";
import { getRegistry, registerModules } from "../src/base/registry/runtime";
import type { ModuleSeedContext } from "../src/base/registry/types";
import {
  campSettings,
  editionMembers,
  editions,
  people,
  roleAssignments,
  roles,
  teamMemberships,
  teams,
} from "../src/base/schema";
import { activePacks } from "../src/lib/active-packs";
import { CAMP_NAME } from "../src/lib/camp";
import { EVENT_NAME } from "../src/lib/event";
import { firstRow } from "../src/lib/rows";
import { modules } from "../src/modules";
import { seedPeople } from "./people";

loadEnv();
registerModules(modules);
const url = process.env.DATABASE_URL ?? "";
if (/neon\.tech/.test(url) && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    "Refusing to seed a Neon database. Seeds are for local dev and previews (set SEED_ALLOW_REMOTE=1 for a preview branch).",
  );
  process.exit(1);
}

export const SEED_IDS = {
  edition2026: "01900000-0000-7000-8000-000000002026",
  edition2027: "01900000-0000-7000-8000-000000002027",
};

// Roles and teams come from the camp's packs (camp-packs/, chosen in camp.config.ts).
const DEMO = [
  { key: "admin", email: "admin@example.test", name: "Admin (demo)" },
  { key: "lead", email: "lead@example.test", name: "Gift projects lead (demo)" },
  { key: "member", email: "member@example.test", name: "Member (demo)" },
  // The demo Applicant persona (spec applicants §8): a prospect, so the applicants seed can give
  // them an application before seed/demo.ts adds the other personas.
  { key: "applicant", email: "applicant@example.test", name: "Kai (demo applicant)" },
  // The demo New applicant persona (member feedback, 21 Oct 2026): just applied, also a prospect.
  {
    key: "new_applicant",
    email: "new-applicant@example.test",
    name: "Nia (demo new applicant)",
  },
] as const;
const APPLYING = new Set<string>(["applicant", "new_applicant"]);

async function seedBase(db: Db) {
  await db
    .insert(editions)
    .values([
      {
        id: SEED_IDS.edition2026,
        year: 2026,
        title: `${EVENT_NAME} 2026`,
        status: "closed",
        memberCapacity: 100,
      },
      {
        id: SEED_IDS.edition2027,
        year: 2027,
        title: `${EVENT_NAME} 2027`,
        status: "planning",
        memberCapacity: 70,
      },
    ])
    .onConflictDoNothing();
  await db
    .insert(campSettings)
    .values({ name: CAMP_NAME, refPrefix: "CMP", currentEditionId: SEED_IDS.edition2027 })
    .onConflictDoNothing();
  await db
    .insert(roles)
    .values(activePacks.roles.map(({ key, label, kind }) => ({ key, label, kind })))
    .onConflictDoNothing();
  await db
    .insert(teams)
    .values(
      activePacks.teams.map(({ key, label }) => ({
        editionId: SEED_IDS.edition2027,
        key,
        name: label,
      })),
    )
    .onConflictDoNothing();

  const system = Actor.system(SEED_IDS.edition2027);
  const ids: Record<string, string> = {};
  const links: string[] = [];
  for (const d of DEMO) {
    const [existing] = await db
      .select()
      .from(people)
      .where(and(eq(people.email, d.email), isNull(people.deletedAt)));
    const live = existing ? await findLiveInviteForPerson(db, existing.id) : null;
    if (existing && live) {
      ids[d.key] = existing.id;
      continue;
    }
    const invite = await createInvite(db, {
      email: d.email,
      displayName: d.name,
      editionId: SEED_IDS.edition2027,
      invitedBy: system,
      sendEmail: false,
      status: APPLYING.has(d.key) ? "prospect" : "confirmed",
    });
    ids[d.key] = invite.personId;
    links.push(`  ${d.email.padEnd(22)} ${invite.url}`);
  }

  const roleId = async (key: string) =>
    firstRow(await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)), key).id;
  const teamId = async (key: string) =>
    firstRow(
      await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.editionId, SEED_IDS.edition2027), eq(teams.key, key))),
      key,
    ).id;

  const idOf = (key: string): string => {
    const id = ids[key];
    if (!id) throw new Error(`Seeded person "${key}" is missing`);
    return id;
  };
  // A re-seed puts the demo applicants back at the start, even if someone made them join.
  await db
    .update(editionMembers)
    .set({ status: "prospect", paymentStatus: "unknown" })
    .where(
      and(
        eq(editionMembers.editionId, SEED_IDS.edition2027),
        inArray(editionMembers.personId, [idOf("applicant"), idOf("new_applicant")]),
      ),
    );
  await db
    .insert(roleAssignments)
    .values({ personId: idOf("admin"), roleId: await roleId("admin"), editionId: null })
    .onConflictDoNothing();
  await db
    .insert(teamMemberships)
    .values([
      { teamId: await teamId("gift_projects"), personId: idOf("lead"), role: "lead" },
      { teamId: await teamId("kitchen"), personId: idOf("member"), role: "member" },
    ])
    .onConflictDoNothing();

  return { ids: ids as ModuleSeedContext["people"], links };
}

async function main() {
  // Migrate first so a fresh clone needs only `pnpm db:up && pnpm seed` (idempotent).
  await runAllMigrations(process.env.DATABASE_URL_UNPOOLED || url);
  const db = getDb();
  console.log("Seeding base…");
  const { ids, links } = await seedBase(db);
  const seeded = await seedPeople(db, SEED_IDS.edition2027);
  console.log(`Seeded ${seeded.people} fake members (plus the 3 demo accounts)`);
  const edition = { id: SEED_IDS.edition2027, year: 2027 };
  const seedAdmin = await loadActorForPerson(db, ids.admin, edition);
  if (!seedAdmin) throw new Error("Seed admin is missing");
  const registry = getRegistry();
  const emitted: string[] = [];
  const events = (moduleId: string) =>
    createEventsApi(db, {
      moduleId,
      actor: Actor.system(edition.id),
      editionId: edition.id,
      now: new Date(),
      registry,
      emitted,
    });

  const modulesDir = path.resolve(import.meta.dirname, "../src/modules");
  for (const id of readdirSync(modulesDir).sort()) {
    const file = path.join(modulesDir, id, "seed.ts");
    if (!existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    const ctx: ModuleSeedContext = {
      db,
      edition,
      people: ids,
      tasks: createModuleTasksApi({ db, actor: seedAdmin, edition }),
      events: events(id),
    };
    await mod.seed(ctx);
    console.log(`Seeded module ${id}`);
  }
  // Deliver what the seeds emitted (e.g. accepted applicants → Finance camp fees).
  if (emitted.length) {
    const r = await dispatchEvents(db, registry, { eventIds: emitted });
    console.log(`Delivered seed events: ${r.done} done, ${r.skipped} skipped, ${r.failed} failed`);
  }

  console.log("\nDemo accounts (fake): go to http://localhost:3000/login and enter one of");
  console.log("  admin@example.test · lead@example.test · member@example.test");
  console.log("The magic link is printed in the `pnpm dev` console.");
  if (links.length) console.log(`New invite links:\n${links.join("\n")}`);
  await closeDb();
}

await main();
