// The automations job: run every enabled module's jobs as the system, then deliver what they
// ask for under the anti-spam rules (rules/reminders.ts). Reminders and handovers are each
// stored once in alert_states (stage = fingerprint), so a second tick the same day sends nothing.
import { and, count, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";
import { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import { getModuleFlags } from "../flags/flags";
import { getRegistry } from "../registry/runtime";
import type { HandoverCandidate, ReminderCandidate } from "../registry/types";
import { alertStates, anchorDates, notifications } from "../schema";
import { notify } from "./notify";
import { roleHolderIds, teamLeadIds } from "./recipients";
import { handoverTitle, pickReminders, quietReason, thingKey } from "./rules/reminders";

/** Level 0 = reminders to the person; level 2 = the handover to a lead. */
const REMINDER_LEVEL = 0;
const HANDOVER_LEVEL = 2;

async function collect(db: DbOrTx, edition: EditionRef, now: Date) {
  const registry = getRegistry();
  const flags = await getModuleFlags(db, registry);
  const ctx = { actor: Actor.system(edition.id), edition, now, db };
  const reminders: ReminderCandidate[] = [];
  const handovers: HandoverCandidate[] = [];
  const failed: string[] = [];
  for (const m of registry.modules) {
    if (!flags.get(m.id)?.enabled) continue;
    for (const job of m.jobs ?? []) {
      try {
        const result = await (await job.run()).default(ctx);
        reminders.push(...(result.reminders ?? []));
        handovers.push(...(result.handovers ?? []));
      } catch (error) {
        // One module's bug never stops the others or the digest; job_runs.stats keeps the reason.
        failed.push(
          `${job.id}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`,
        );
      }
    }
  }
  return { reminders, handovers, failed };
}

async function burnWindow(db: DbOrTx, edition: EditionRef) {
  const rows = await db
    .select({ key: anchorDates.key, startsAt: anchorDates.startsAt })
    .from(anchorDates)
    .where(
      and(
        eq(anchorDates.editionId, edition.id),
        inArray(anchorDates.key, ["event_start", "event_end"]),
      ),
    );
  const start = rows.find((r) => r.key === "event_start")?.startsAt;
  return start
    ? { startsAt: start, endsAt: rows.find((r) => r.key === "event_end")?.startsAt ?? null }
    : null;
}

/** Earlier reminder stages per person and thing, from alert_states fingerprints "<person>:<stage>". */
async function history(db: DbOrTx, rules: string[]) {
  const sent = new Set<string>();
  const before = new Map<string, number>();
  if (!rules.length) return { sent, before };
  const rows = await db
    .select({
      rule: alertStates.ruleKey,
      entityId: alertStates.entityId,
      fingerprint: alertStates.fingerprint,
    })
    .from(alertStates)
    .where(and(inArray(alertStates.ruleKey, rules), eq(alertStates.level, REMINDER_LEVEL)));
  for (const r of rows) {
    const [personId = "", stage = ""] = r.fingerprint.split(":");
    const key = `${r.rule}|${r.entityId}|${personId}`; // = thingKey
    sent.add(`${key}|${stage}`);
    before.set(key, (before.get(key) ?? 0) + 1);
  }
  return { sent, before };
}

/** Automation reminders each person already got since midnight camp time. */
async function sentToday(db: DbOrTx, rules: string[], now: Date) {
  const today = new Map<string, number>();
  if (!rules.length) return today;
  const midnight = campInputToInstant(instantToCampInput(now).date, "00:00");
  const rows = await db
    .select({ personId: notifications.recipientPersonId, n: count() })
    .from(notifications)
    .where(
      and(
        inArray(notifications.type, rules),
        isNotNull(notifications.alertStateId),
        gte(notifications.createdAt, midnight),
      ),
    )
    .groupBy(notifications.recipientPersonId);
  for (const r of rows) today.set(r.personId, r.n);
  return today;
}

async function store(
  db: DbOrTx,
  c: { rule: string; entityType: string; entityId: string },
  level: number,
  fingerprint: string,
  now: Date,
) {
  const [state] = await db
    .insert(alertStates)
    .values({
      ruleKey: c.rule,
      entityType: c.entityType,
      entityId: c.entityId,
      level,
      fingerprint,
      firstFiredAt: now,
      lastFiredAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: alertStates.id });
  return state ?? null;
}

async function handoverRecipients(
  db: DbOrTx,
  h: HandoverCandidate,
  edition: EditionRef,
  now: Date,
) {
  if ("personIds" in h.to) return h.to.personIds;
  if ("teamId" in h.to) return teamLeadIds(db, h.to.teamId);
  return roleHolderIds(db, h.to.role, edition, now);
}

export async function runAutomations(db: DbOrTx, edition: EditionRef, now: Date) {
  const { reminders, handovers, failed } = await collect(db, edition, now);
  const hour = Number(instantToCampInput(now).time.slice(0, 2));
  const quiet = quietReason(hour, now, await burnWindow(db, edition));
  const counts = { candidates: reminders.length, handoverCandidates: handovers.length };
  if (quiet) return { ...counts, skipped: quiet, failed };

  const rules = [...new Set(reminders.map((r) => r.rule))];
  const { sent, before } = await history(db, rules);
  const fresh = reminders.filter((r) => !sent.has(`${thingKey(r)}|${r.stage}`));
  let reminded = 0;
  for (const r of pickReminders(fresh, before, await sentToday(db, rules, now))) {
    const state = await store(db, r, REMINDER_LEVEL, `${r.personId}:${r.stage}`, now);
    if (!state) continue;
    const n = await notify(db, {
      recipientPersonId: r.personId,
      type: r.rule,
      entityType: r.entityType,
      entityId: r.entityId,
      title: r.title,
      href: r.href,
      alertStateId: state.id,
      digestOnly: true,
    });
    if (n) reminded++;
  }

  let handedOver = 0;
  for (const h of handovers) {
    const state = await store(db, h, HANDOVER_LEVEL, "handover", now);
    if (!state) continue; // already handed over; the queue item stays until it's solved
    handedOver++;
    for (const personId of await handoverRecipients(db, h, edition, now))
      await notify(db, {
        recipientPersonId: personId,
        type: h.rule,
        entityType: h.entityType,
        entityId: h.entityId,
        title: handoverTitle(h),
        href: h.href,
        alertStateId: state.id,
        digestOnly: true,
      });
  }
  return { ...counts, reminded, handedOver, failed };
}
