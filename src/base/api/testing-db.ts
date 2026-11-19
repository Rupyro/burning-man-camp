// DB test harness for the base and for every module (import from "@/base/api/testing-db"
// in *.db.test.ts files only). Wipes data, creates a tiny camp, acts as someone, and

// exposes the framework hooks a module's flag/event/landing tests need.
import { sql } from "drizzle-orm";
import { EVENT_NAME } from "@/lib/event";
import { firstRow } from "@/lib/rows";
import type { ModuleAudience } from "../authz/access";
import { Actor } from "../authz/actor";
import { getDb } from "../db/client";
import { clearSentEmails, setEmailAdapter } from "../email/adapter";
import { createModuleTasksApi } from "../engine/module-tasks";
import { dispatchEvents } from "../events/dispatch";
import { createEventsApi } from "../events/emit";
import { setModuleFlag } from "../flags/flags";
import { guardModuleLayout } from "../guard/guard-layout";
import { setClock, setRequestContextProvider } from "../guard/request";
import { getLandingData } from "../landing/landing";
import { loadActorForPerson } from "../people/actor-loader";
import { getRegistry } from "../registry/runtime";
import type { ModuleId, ModuleTasksApi } from "../registry/types";
import {
  auditEvents,
  campSettings,
  domainEventDeliveries,
  domainEvents,
  editionMembers,
  editions,
  people,
  roleAssignments,
  roles,
  teamMemberships,
  teams,
} from "../schema";

export const EDITION = { id: "01900000-0000-7000-8000-000000002027", year: 2027 };

export async function truncateAll() {
  const db = getDb();
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle_migrations%'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
  setRequestContextProvider(undefined);
  setClock(undefined);
  setEmailAdapter(undefined);
  clearSentEmails();
}

type PersonSpec = {
  email: string;
  name: string;
  status?: "prospect" | "waitlisted" | "confirmed" | "withdrawn" | "removed" | null;
  roles?: string[];
  teams?: { key: string; role: "lead" | "co_lead" | "member" }[];
};

/** A small camp: edition 2027 (current), role catalogue, two teams. */
export async function createCamp() {
  const db = getDb();
  await db.insert(editions).values({
    id: EDITION.id,
    year: EDITION.year,
    title: `${EVENT_NAME} 2027`,
    status: "planning",
  });
  await db
    .insert(campSettings)
    .values({ name: "Test camp", refPrefix: "TST", currentEditionId: EDITION.id });
  await db.insert(roles).values(
    ["admin", "camp_lead", "pilot", "finance_approver"].map((key) => ({
      key,
      label: key,
      kind: "system" as const,
    })),
  );
  await db.insert(teams).values([
    { editionId: EDITION.id, key: "kitchen", name: "Kitchen" },
    { editionId: EDITION.id, key: "gift_projects", name: "Gift projects" },
  ]);
}

export async function createPerson(spec: PersonSpec): Promise<string> {
  const db = getDb();
  const p = firstRow(
    await db.insert(people).values({ email: spec.email, displayName: spec.name }).returning(),
    "person",
  );
  if (spec.status !== null) {
    await db
      .insert(editionMembers)
      .values({ editionId: EDITION.id, personId: p.id, status: spec.status ?? "confirmed" });
  }
  for (const key of spec.roles ?? []) {
    const role = firstRow(await db.select().from(roles).where(sql`${roles.key} = ${key}`), key);
    // Only admin is permanent; officer and lead roles must name a year.
    await db
      .insert(roleAssignments)
      .values({ personId: p.id, roleId: role.id, editionId: key === "admin" ? null : EDITION.id });
  }
  for (const t of spec.teams ?? []) {
    const team = firstRow(await db.select().from(teams).where(sql`${teams.key} = ${t.key}`), t.key);
    await db.insert(teamMemberships).values({ teamId: team.id, personId: p.id, role: t.role });
  }
  return p.id;
}

export async function actorFor(personId: string): Promise<Actor> {
  const actor = await loadActorForPerson(getDb(), personId, EDITION);
  if (!actor) throw new Error("no actor");
  return actor;
}

/** The task engine as a module's seed or action sees it, acting as this person. */
export async function tasksApiFor(personId: string): Promise<ModuleTasksApi> {
  return createModuleTasksApi({ db: getDb(), actor: await actorFor(personId), edition: EDITION });
}

/** Add a team to the test camp (createCamp only makes kitchen and gift_projects). */
export async function addTeam(key: string, name = key) {
  await getDb().insert(teams).values({ editionId: EDITION.id, key, name }).onConflictDoNothing();
}

/** Make the guard see this person as signed in (no cookie), or nobody. */
export async function actAs(personId: string | null) {
  if (!personId) return setRequestContextProvider(async () => null);
  const actor = await actorFor(personId);
  setRequestContextProvider(async () => ({ actor, edition: EDITION }));
}

/** What the landing page would show this person (tiles + my stuff), computed on the server. */
export async function landingFor(personId: string) {
  return getLandingData(getDb(), getRegistry(), await actorFor(personId), EDITION);
}

/** Render a module's guarded layout as this person: "ok", "404" (hidden) or "redirect" (signed out). */
export async function layoutStatus(
  moduleId: ModuleId,
  personId: string | null,
): Promise<"ok" | "404" | "redirect"> {
  await actAs(personId);
  try {
    await guardModuleLayout(moduleId)({ children: null });
    return "ok";
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.includes("404")) return "404";
    if (digest.startsWith("NEXT_REDIRECT")) return "redirect";
    throw error;
  }
}

/** Switch a module on/off or change its audience, as this person (audited). */
export async function setFlagAs(
  personId: string,
  moduleId: ModuleId,
  change: { enabled?: boolean; audience?: ModuleAudience },
) {
  return setModuleFlag(getDb(), getRegistry(), await actorFor(personId), moduleId, change);
}

/** The events emitter a module's seed gets from seed/index.ts (system actor, this edition). */
export function seedEventsFor(moduleId: ModuleId) {
  return createEventsApi(getDb(), {
    moduleId,
    actor: Actor.system(EDITION.id),
    editionId: EDITION.id,
    now: new Date(),
    registry: getRegistry(),
    emitted: [],
  });
}

/** Run the event dispatcher over everything due (what the jobs tick will do). */
export async function dispatchPending(now?: Date) {
  return dispatchEvents(getDb(), getRegistry(), { now });
}

export { getDb };
export const baseTables = { auditEvents, domainEvents, domainEventDeliveries };
