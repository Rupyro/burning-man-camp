// Pure base alert rules (PLAN.md §4.3, spec A1–A4, A7): (now, facts, params) → alerts.
// The jobs tick stores each (rule, task, level, fingerprint) once in alert_states (A5).
import { isOpen, type TaskStatus } from "./risk";

const DAY = 86_400_000;

export interface AlertFact {
  taskId: string;
  title: string;
  status: TaskStatus;
  kind: string;
  isCritical: boolean;
  dueAt: Date | null;
  ownerPersonId: string | null;
  teamId: string;
  /** A prerequisite is not done and is overdue or blocked (rules/risk.ts isAtRisk). */
  prerequisiteRisk: boolean;
  /** The task kind's manifest asks for overdue to reach the camp lead on day 1 (e.g. obligations). */
  escalateImmediately?: boolean;
  /** The task kind's module sends its own due-soon reminders (e.g. obligations rule 15). */
  ownDueSoon?: boolean;
}

export type AlertRecipient = "owner" | "team_leads" | "camp_leads";
export type BaseRuleKey = "due_soon" | "overdue" | "unowned" | "dependency_risk" | "stalled";

export interface TaskAlert {
  rule: BaseRuleKey;
  taskId: string;
  teamId: string;
  ownerPersonId: string | null;
  /** 0 owner, 1 team lead, 2 camp lead (DATA_MODEL.md §12 alert_states). */
  level: 0 | 1 | 2;
  fingerprint: string;
  to: AlertRecipient;
  title: string;
  href: string;
}

export type AlertParams = {
  due_soon: { enabled: boolean; days_before: number[] };
  overdue: { enabled: boolean; escalate_after_days: [toLead: number, toCamp: number] };
  unowned: { enabled: boolean; within_days: number; escalate_within_days: number };
  dependency_risk: { enabled: boolean; within_days: number };
};

/** Placeholders from PLAN.md §4.3, tunable in alert_rules without a deploy. */
export const DEFAULT_ALERT_PARAMS: AlertParams = {
  due_soon: { enabled: true, days_before: [3, 1] },
  overdue: { enabled: true, escalate_after_days: [3, 7] },
  unowned: { enabled: true, within_days: 14, escalate_within_days: 7 },
  dependency_risk: { enabled: true, within_days: 14 },
};

/** One alert_rules row: typed day thresholds, null = the default (the DB checks the ranges). */
export interface AlertRuleRow {
  key: string;
  enabled: boolean;
  remindDaysBefore: number | null;
  remindAgainDaysBefore: number | null;
  escalateLeadAfterDays: number | null;
  escalateCampAfterDays: number | null;
  withinDays: number | null;
  escalateWithinDays: number | null;
  remindHoursBefore?: number | null;
  remindAgainHoursBefore?: number | null;
  escalateLeadHoursBefore?: number | null;
}

/** Hour thresholds a module rule reads from its alert_rules row (shared by every module). */
export interface AlertHours {
  enabled: boolean;
  remindHoursBefore: number;
  remindAgainHoursBefore: number;
  escalateLeadHoursBefore: number;
}

/** One rule's hour thresholds: the row's values, or the module's defaults where empty. */
export function alertHours(
  row: AlertRuleRow | undefined,
  defaults: Omit<AlertHours, "enabled">,
): AlertHours {
  return {
    enabled: row?.enabled ?? true,
    remindHoursBefore: row?.remindHoursBefore ?? defaults.remindHoursBefore,
    remindAgainHoursBefore: row?.remindAgainHoursBefore ?? defaults.remindAgainHoursBefore,
    escalateLeadHoursBefore: row?.escalateLeadHoursBefore ?? defaults.escalateLeadHoursBefore,
  };
}

/** alert_rules rows → params. Unknown keys are ignored; empty thresholds use the defaults. */
export function parseAlertParams(rows: readonly AlertRuleRow[]): AlertParams {
  const row = (key: BaseRuleKey) => rows.find((r) => r.key === key);
  const d = DEFAULT_ALERT_PARAMS;
  const dueSoon = row("due_soon");
  const overdue = row("overdue");
  const unowned = row("unowned");
  const risk = row("dependency_risk");
  const [first = 3, second = 1] = d.due_soon.days_before;
  return {
    due_soon: {
      enabled: dueSoon?.enabled ?? true,
      days_before: [dueSoon?.remindDaysBefore ?? first, dueSoon?.remindAgainDaysBefore ?? second],
    },
    overdue: {
      enabled: overdue?.enabled ?? true,
      escalate_after_days: [
        overdue?.escalateLeadAfterDays ?? d.overdue.escalate_after_days[0],
        overdue?.escalateCampAfterDays ?? d.overdue.escalate_after_days[1],
      ],
    },
    unowned: {
      enabled: unowned?.enabled ?? true,
      within_days: unowned?.withinDays ?? d.unowned.within_days,
      escalate_within_days: unowned?.escalateWithinDays ?? d.unowned.escalate_within_days,
    },
    dependency_risk: {
      enabled: risk?.enabled ?? true,
      within_days: risk?.withinDays ?? d.dependency_risk.within_days,
    },
  };
}

const LABEL: Record<BaseRuleKey, string> = {
  due_soon: "Due soon",
  overdue: "Overdue",
  unowned: "Needs an owner",
  dependency_risk: "At risk (a task it depends on is late or blocked)",
  stalled: "Gone quiet",
};

export function evaluateTaskAlerts(
  facts: readonly AlertFact[],
  now: Date,
  params: AlertParams,
): TaskAlert[] {
  const out: TaskAlert[] = [];
  for (const f of facts) {
    if (!isOpen(f.status) || !f.dueAt) continue;
    const due = f.dueAt;
    const untilDue = (due.getTime() - now.getTime()) / DAY;
    const fp = due.toISOString();
    const push = (rule: BaseRuleKey, level: 0 | 1 | 2, to: AlertRecipient, fingerprint = fp) =>
      out.push({
        rule,
        taskId: f.taskId,
        teamId: f.teamId,
        ownerPersonId: f.ownerPersonId,
        level,
        fingerprint,
        to,
        title: `${LABEL[rule]}: ${f.title}`,
        href: `/tasks/${f.taskId}`,
      });

    if (params.due_soon.enabled && !f.ownDueSoon && f.ownerPersonId && untilDue >= 0) {
      const crossed = [...params.due_soon.days_before]
        .sort((a, b) => a - b)
        .find((d) => untilDue <= d);
      if (crossed !== undefined) push("due_soon", 0, "owner", `${fp}:${crossed}d`);
    }
    if (params.overdue.enabled && f.ownerPersonId && untilDue < 0) {
      const late = -untilDue;
      const [toLead = 3, toCamp = 7] = params.overdue.escalate_after_days;
      push("overdue", 0, "owner");
      if (late >= toLead) push("overdue", 1, "team_leads");
      if (late >= toCamp || f.kind === "milestone" || f.isCritical || f.escalateImmediately)
        push("overdue", 2, "camp_leads");
    }
    if (params.unowned.enabled && !f.ownerPersonId && untilDue <= params.unowned.within_days) {
      push("unowned", 1, "team_leads");
      if (untilDue <= params.unowned.escalate_within_days) push("unowned", 2, "camp_leads");
    }
    if (
      params.dependency_risk.enabled &&
      f.prerequisiteRisk &&
      untilDue <= params.dependency_risk.within_days
    ) {
      if (f.ownerPersonId) push("dependency_risk", 0, "owner");
      push("dependency_risk", 1, "team_leads");
    }
  }
  return out;
}

export interface StalledFact {
  taskId: string;
  title: string;
  status: TaskStatus;
  ownerPersonId: string | null;
  ownerName: string | null;
  teamId: string;
  /** The last change to the task or its discussion. */
  touchedAt: Date;
  dueAt?: Date | null;
}

/**
 * Rule 5 (Oct 28 2026): an owned task nobody has touched for `quietDays` goes back to the team's
 * leads to give to someone else. Once per quiet spell: touching it starts a new one. Blocked tasks
 * already say why they're waiting, and overdue ones are already with the overdue rule, so both
 * are left alone.
 */
export function stalledTaskAlerts(
  facts: readonly StalledFact[],
  now: Date,
  quietDays: number,
): TaskAlert[] {
  const out: TaskAlert[] = [];
  for (const f of facts) {
    if (f.status !== "todo" && f.status !== "in_progress") continue;
    if (!f.ownerPersonId) continue;
    if (f.dueAt && f.dueAt.getTime() < now.getTime()) continue; // the overdue rule has it
    const quiet = Math.floor((now.getTime() - f.touchedAt.getTime()) / DAY);
    if (quiet < quietDays) continue;
    out.push({
      rule: "stalled",
      taskId: f.taskId,
      teamId: f.teamId,
      ownerPersonId: f.ownerPersonId,
      level: 1,
      fingerprint: f.touchedAt.toISOString(),
      to: "team_leads",
      title: `"${f.title}" hasn't moved in ${quiet} days${f.ownerName ? ` (${f.ownerName} has it)` : ""}`,
      href: `/tasks/${f.taskId}`,
    });
  }
  return out;
}
