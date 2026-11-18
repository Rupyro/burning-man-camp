// Kit automation (automation plan rule 14). Pure: facts in, reminders and handovers out.
import type { HandoverCandidate, JobResult } from "@/contracts/automations";
import { daysSince, stageReached } from "@/lib/days";

/** Weekly reminders to the team's leads while nobody has claimed the need (max 3). */
export const UNCLAIMED_DAYS = [7, 14, 21] as const;
/** Still unclaimed this close to its needed-by date → the camp lead. */
export const UNCLAIMED_HANDOVER_WITHIN_DAYS = 14;

export interface UnclaimedFact {
  needId: string;
  itemName: string;
  teamId: string;
  teamName: string;
  raisedAt: Date;
  /** Noon camp time on the needed-by day, or null. */
  neededBy: Date | null;
  leadIds: readonly string[];
}

export function kitAutomations(
  needs: readonly UnclaimedFact[],
  now: Date,
): Required<Pick<JobResult, "reminders" | "handovers">> {
  const out: Required<Pick<JobResult, "reminders" | "handovers">> = {
    reminders: [],
    handovers: [],
  };
  for (const n of needs) {
    const entity = { entityType: "procurement.need", entityId: n.needId };
    const href = `/procurement/n/${n.needId}`;
    const stage = stageReached(daysSince(n.raisedAt, now), UNCLAIMED_DAYS);
    if (stage !== null)
      for (const personId of n.leadIds)
        out.reminders.push({
          rule: "procurement.unclaimed",
          ...entity,
          personId,
          stage: `d${stage}`,
          priority: 3,
          title: `Nobody has picked up ${n.itemName} for ${n.teamName}`,
          href,
        });
    const left = n.neededBy ? daysSince(now, n.neededBy) : null;
    if (left !== null && left <= UNCLAIMED_HANDOVER_WITHIN_DAYS)
      out.handovers.push({
        rule: "procurement.unclaimed",
        ...entity,
        to: { role: "camp_lead" },
        what: `Unclaimed kit, needed in ${Math.max(left, 0)} days`,
        about: `${n.itemName} (${n.teamName})`,
        why: "team leads reminded, still no owner",
        href,
      });
  }
  return out;
}

export interface OpenNeedFact {
  needId: string;
  itemName: string;
  teamId: string;
  teamName: string;
  /** Noon camp time on the needed-by day, or null. */
  neededBy: Date | null;
  /** Who said they'd buy or borrow it, if anyone. */
  ownerName: string | null;
}

/**
 * Rule 2 (Oct 28 2026): still not bought `withinDays` days before it's needed, so the team's
 * leads are told once. The number of days is a camp setting (buy_alert_days).
 */
export function buyDeadlineAlerts(
  needs: readonly OpenNeedFact[],
  now: Date,
  withinDays: number,
): HandoverCandidate[] {
  const out: HandoverCandidate[] = [];
  for (const n of needs) {
    if (!n.neededBy) continue;
    const left = daysSince(now, n.neededBy);
    if (left > withinDays) continue;
    const when =
      left <= 0 ? "it's needed now" : `it's needed in ${left} day${left === 1 ? "" : "s"}`;
    out.push({
      rule: "procurement.not_bought",
      entityType: "procurement.need",
      entityId: n.needId,
      to: { teamId: n.teamId },
      what: `Nobody has bought ${n.itemName} yet`,
      about: n.ownerName ? `${n.ownerName} said they would buy it` : "Nobody has picked it up",
      why: `${when}; the warning goes out ${withinDays} days before`,
      href: `/procurement/n/${n.needId}`,
    });
  }
  return out;
}
