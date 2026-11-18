// Applicant automations (automation plan rules 1–3). Pure: facts in, reminders and handovers out.
import type { JobResult } from "@/contracts/automations";
import { daysSince, stageReached } from "@/lib/days";
import { type ApplicationStatus, REQUIRED_DOCS } from "./journey";

export interface ApplicantFact {
  id: string;
  personId: string;
  name: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
  decidedAt: Date | null;
  interviewDoneAt: Date | null;
  feeCents: number | null;
  paidAt: Date | null;
  docsDone: readonly string[];
  /** The member's team, when they have one; its leads hear about an unpaid fee. */
  teamId?: string | null;
}

/** Rule 1: the fee is due when the application is accepted. A friendly reminder N days after
 * (camp setting, default 1), then the team lead (or the camp lead, before the member has a team)
 * is told M days after that reminder (camp setting, default 7). */
export const FEE_REMINDER_DAYS_DEFAULT = 1;
export const FEE_LEAD_DAYS_DEFAULT = 7;
export interface FeeTiming {
  reminderDays: number;
  leadDays: number;
}
/** Rule 2: weekly reminders about missing requirements, max 3; handed over the day after. */
export const REQUIREMENT_DAYS = [7, 14, 21] as const;
/** Rule 3: leads nudged after 5 days unreviewed; the camp lead gets it at 10. */
export const REVIEW_NUDGE_DAYS = 5;
export const REVIEW_HANDOVER_DAYS = 10;

const after = (stages: readonly number[]) => (stages.at(-1) ?? 0) + 1;

/** Requirements other than the fee (rule 1 chases the fee). */
export function missingRequirements(a: ApplicantFact): string[] {
  const missing = a.interviewDoneAt ? [] : ["Interview"];
  for (const d of REQUIRED_DOCS) if (!a.docsDone.includes(d.key)) missing.push(d.title);
  return missing;
}

export function applicantAutomations(
  apps: readonly ApplicantFact[],
  now: Date,
  reviewerIds: readonly string[],
  fee: FeeTiming = { reminderDays: FEE_REMINDER_DAYS_DEFAULT, leadDays: FEE_LEAD_DAYS_DEFAULT },
): Required<Pick<JobResult, "reminders" | "handovers">> {
  const out: Required<Pick<JobResult, "reminders" | "handovers">> = {
    reminders: [],
    handovers: [],
  };
  const app = (a: ApplicantFact) => ({ entityType: "applicants.application", entityId: a.id });
  for (const a of apps) {
    if (a.status === "accepted" && a.decidedAt) {
      const days = daysSince(a.decidedAt, now);
      if (a.feeCents !== null && !a.paidAt) {
        const stage = stageReached(days, [fee.reminderDays]);
        if (stage !== null)
          out.reminders.push({
            rule: "applicants.fee_unpaid",
            ...app(a),
            personId: a.personId,
            stage: `d${stage}`,
            priority: 1,
            title: "Your camp fee is due. If something makes it hard to pay, let us know",
            href: "/apply",
          });
        if (days >= fee.reminderDays + fee.leadDays)
          out.handovers.push({
            rule: "applicants.fee_unpaid",
            ...app(a),
            to: a.teamId ? { teamId: a.teamId } : { role: "camp_lead" },
            what: `Camp fee still unpaid after ${days} days`,
            about: a.name,
            why: `Reminded ${fee.leadDays} days ago. It might be worth a quick chat`,
            href: `/apply/review/${a.id}`,
          });
      }
      const missing = missingRequirements(a);
      if (missing.length) {
        const stage = stageReached(days, REQUIREMENT_DAYS);
        if (stage !== null)
          out.reminders.push({
            rule: "applicants.requirement_missing",
            ...app(a),
            personId: a.personId,
            stage: `d${stage}`,
            priority: 2,
            title: `Still needed to join: ${missing.join(", ")}`,
            href: "/apply",
          });
        if (days >= after(REQUIREMENT_DAYS))
          out.handovers.push({
            rule: "applicants.requirement_missing",
            ...app(a),
            to: { role: "camp_lead" },
            what: `Stuck on ${missing[0]} for ${Math.floor(days / 7)} weeks`,
            about: a.name,
            why: "3 weekly reminders, still missing",
            href: `/apply/review/${a.id}`,
          });
      }
    }
    if (a.status === "applied" && a.submittedAt) {
      const days = daysSince(a.submittedAt, now);
      if (days >= REVIEW_NUDGE_DAYS)
        for (const personId of reviewerIds.filter((id) => id !== a.personId))
          out.reminders.push({
            rule: "applicants.review_waiting",
            ...app(a),
            personId,
            stage: `d${REVIEW_NUDGE_DAYS}`,
            priority: 2,
            title: `${a.name}'s application is waiting ${days} days for a review`,
            href: `/apply/review/${a.id}`,
          });
      if (days >= REVIEW_HANDOVER_DAYS)
        out.handovers.push({
          rule: "applicants.review_waiting",
          ...app(a),
          to: { role: "camp_lead" },
          what: `Application not reviewed in ${days} days`,
          about: a.name,
          why: "leads nudged, no review yet",
          href: `/apply/review/${a.id}`,
        });
    }
  }
  return out;
}
