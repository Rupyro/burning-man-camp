// Idempotent: the demo personas, invited, with their team and roles. Everyone is a confirmed
// member except the applicants (Applicant, New applicant), who are (re)set to prospects
// (spec applicants §8).
import { and, eq, inArray, isNull } from "drizzle-orm";
import { findLiveInviteForPerson } from "../auth/eligibility";
import { createInvite } from "../auth/invites";
import { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { editionMembers, people, roleAssignments, roles, teamMemberships, teams } from "../schema";
import { PERSONAS, type PersonaKey } from "./personas";

/** Personas who are applying, not members: prospects on every seed. */
const APPLYING: readonly PersonaKey[] = ["applicant", "new_applicant"];
/** Alex comes for build week, Sam later in the week (Burn Mode prompts on arrival day). */
const DEMO_ARRIVALS: readonly [PersonaKey, Date][] = [
  ["kitchen_lead", new Date(Date.UTC(2027, 3, 22, 8))],
  ["member", new Date(Date.UTC(2027, 3, 26, 10))],
];

export async function seedPersonas(db: DbOrTx, editionId: string) {
  await db
    .insert(roles)
    .values([
      { key: "admin", label: "Admin", kind: "system" },
      { key: "finance_approver", label: "Finance approver", kind: "capability" },
      {
        key: "kitchen_sensitive_viewer",
        label: "Sees diets and allergies by name",
        kind: "capability",
      },
    ])
    .onConflictDoNothing();
  const system = Actor.system(editionId);
  for (const p of PERSONAS) {
    const [existing] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.email, p.email), isNull(people.deletedAt)));
    const live = existing ? await findLiveInviteForPerson(db, existing.id) : null;
    if (existing)
      await db.update(people).set({ displayName: p.name }).where(eq(people.id, existing.id));
    if (!existing || !live)
      await createInvite(db, {
        email: p.email,
        displayName: p.name,
        editionId,
        invitedBy: system,
        sendEmail: false,
      });
  }
  const ids = await personaIds(db);
  await db
    .insert(editionMembers)
    .values(
      Object.entries(ids).map(([key, personId]) => ({
        editionId,
        personId,
        status: APPLYING.includes(key as PersonaKey)
          ? ("prospect" as const)
          : ("confirmed" as const),
      })),
    )
    .onConflictDoNothing();
  await db
    .update(editionMembers)
    .set({ status: "prospect", paymentStatus: "unknown" })
    .where(
      and(
        eq(editionMembers.editionId, editionId),
        inArray(editionMembers.personId, APPLYING.map((k) => ids[k]).filter(Boolean)),
      ),
    );
  // Burn Mode demo: two personas with arrival dates (kept if someone already changed them).
  for (const [key, arrivalAt] of DEMO_ARRIVALS)
    await db
      .update(editionMembers)
      .set({ arrivalAt })
      .where(
        and(
          eq(editionMembers.editionId, editionId),
          eq(editionMembers.personId, ids[key] ?? ""),
          isNull(editionMembers.arrivalAt),
        ),
      );
  const roleId = async (key: string) =>
    (await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)))[0]?.id ?? "";
  await db
    .insert(roleAssignments)
    .values([
      { personId: ids.admin, roleId: await roleId("admin") },
      // Per-year roles carry the year (officer and lead roles require one).
      { personId: ids.diet_viewer, roleId: await roleId("kitchen_sensitive_viewer"), editionId },
      { personId: ids.finance_approver, roleId: await roleId("finance_approver"), editionId },
    ])
    .onConflictDoNothing();
  const [kitchen] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.editionId, editionId), eq(teams.key, "kitchen")));
  if (kitchen)
    await db
      .insert(teamMemberships)
      .values([
        { teamId: kitchen.id, personId: ids.kitchen_lead, role: "lead" },
        { teamId: kitchen.id, personId: ids.member, role: "member" },
        { teamId: kitchen.id, personId: ids.diet_viewer, role: "member" },
      ])
      .onConflictDoNothing();
  const [finance] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.editionId, editionId), eq(teams.key, "finance")));
  if (finance)
    await db
      .insert(teamMemberships)
      .values({ teamId: finance.id, personId: ids.finance_approver, role: "lead" })
      .onConflictDoNothing();
  return ids;
}

export async function personaIds(db: DbOrTx): Promise<Record<PersonaKey, string>> {
  const rows = await db
    .select({ id: people.id, email: people.email })
    .from(people)
    .where(
      and(
        isNull(people.deletedAt),
        inArray(
          people.email,
          PERSONAS.map((p) => p.email),
        ),
      ),
    );
  const out = {} as Record<PersonaKey, string>;
  for (const p of PERSONAS) {
    const row = rows.find((r) => r.email === p.email);
    if (row) out[p.key] = row.id;
  }
  return out;
}
