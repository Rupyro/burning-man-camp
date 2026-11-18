// What a module job hands the base to deliver (automation plan). The base applies the
// anti-spam rules; modules only say who, what and when.

/** A reminder the module would like to send; the base applies the anti-spam limits. */
export interface ReminderCandidate {
  /** "<module>.<rule>", also the notification type. */
  rule: `${string}.${string}`;
  entityType: string;
  entityId: string;
  personId: string;
  /** Which reminder this is, e.g. "d7". Each stage goes once. */
  stage: string;
  /** Lower = more urgent (sent first when a person hits the daily cap). */
  priority: number;
  title: string;
  href: string;
}

/** Who a handover goes to: a team's leads, holders of a role, or named people. */
export type HandoverTo =
  | { teamId: string }
  | { role: "camp_lead" | "finance_approver" }
  | { personIds: string[] };

/** The system stopped and a person must act. Shown the same way everywhere. */
export interface HandoverCandidate {
  rule: `${string}.${string}`;
  entityType: string;
  entityId: string;
  to: HandoverTo;
  /** What's stuck, e.g. "Fee unpaid 14 days". */
  what: string;
  /** Who or what it's about, e.g. the applicant's name. */
  about?: string;
  /** Why the system stopped, e.g. "3 reminders, no reply". */
  why: string;
  href: string;
}

export interface JobResult {
  reminders?: ReminderCandidate[];
  handovers?: HandoverCandidate[];
  stats?: Record<string, number>;
}
