// Pure anti-spam rules for module automations (automation plan, "Not spamming anyone"):
// digest only, at most 3 reminders per thing per person, at most 5 new ones per person per day
// (most urgent first, the rest roll to tomorrow), nothing in quiet hours or during the Burn.
import type { HandoverCandidate, ReminderCandidate } from "@/contracts/automations";

export const REMINDER_LIMITS = {
  perThing: 3,
  perPersonPerDay: 5,
  /** Camp-time hours: quiet from 21:00 until 07:00. */
  quietFrom: 21,
  quietUntil: 7,
} as const;

/** Why nothing goes out right now, or null when reminders may go. */
export function quietReason(
  campHour: number,
  now: Date,
  burn: { startsAt: Date; endsAt: Date | null } | null,
): "quiet_hours" | "burn" | null {
  if (campHour >= REMINDER_LIMITS.quietFrom || campHour < REMINDER_LIMITS.quietUntil)
    return "quiet_hours";
  if (burn && now >= burn.startsAt && (!burn.endsAt || now <= burn.endsAt)) return "burn";
  return null;
}

/** One person's reminders about one thing share this key (the cap counts per key). */
export const thingKey = (r: Pick<ReminderCandidate, "rule" | "entityId" | "personId">) =>
  `${r.rule}|${r.entityId}|${r.personId}`;

/**
 * Which candidates to send now. `sentBefore` counts earlier reminders per thingKey; `sentToday`
 * counts reminders each person already got today. Stages already sent are filtered by the caller
 * (alert_states dedupe), so a candidate here is always a new stage.
 */
export function pickReminders(
  candidates: readonly ReminderCandidate[],
  sentBefore: ReadonlyMap<string, number>,
  sentToday: ReadonlyMap<string, number>,
): ReminderCandidate[] {
  const ordered = [...candidates].sort(
    (a, b) => a.priority - b.priority || a.title.localeCompare(b.title),
  );
  const today = new Map(sentToday);
  const picked: ReminderCandidate[] = [];
  const seen = new Set<string>();
  for (const c of ordered) {
    const key = thingKey(c);
    if (seen.has(key)) continue; // one stage per thing per run
    if ((sentBefore.get(key) ?? 0) >= REMINDER_LIMITS.perThing) continue;
    const n = today.get(c.personId) ?? 0;
    if (n >= REMINDER_LIMITS.perPersonPerDay) continue;
    seen.add(key);
    today.set(c.personId, n + 1);
    picked.push(c);
  }
  return picked;
}

/** Every handover reads the same: what's stuck and about whom… */
export const handoverHeadline = (h: Pick<HandoverCandidate, "what" | "about">) =>
  `${h.what}${h.about ? `: ${h.about}` : ""}`;

/** …and, in the digest line, why the system stopped. */
export const handoverTitle = (h: Pick<HandoverCandidate, "what" | "about" | "why">) =>
  `${handoverHeadline(h)} (${h.why})`;
