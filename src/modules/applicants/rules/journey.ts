// The applicant journey (docs/specs/applicants.md §2). Pure: no db, no next.
import { MONEY_SYMBOL } from "@/lib/camp";

export const APPLICATION_STATUSES = [
  "draft",
  "applied",
  "interview_scheduled",
  "accepted",
  "joined",
  "declined",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** What the journey rules need to know about one application. */
export interface JourneyFacts {
  status: ApplicationStatus;
  submittedAt: Date | null;
  interviewAt: Date | null;
  interviewDoneAt: Date | null;
  feeCents: number | null;
  paidAt: Date | null;
  /** Keys of the required documents the applicant has confirmed. */
  docsDone: readonly string[];
}

/** PLACEHOLDER required documents (read-and-confirm) until Ruchir sends the real ones. */
export const REQUIRED_DOCS = [
  {
    key: "camp_agreement",
    title: "Camp agreement (placeholder)",
    body: "I'll pull my weight: build, my shifts, strike and leaving no trace. I'll respect the camp's quiet zone and the people in it.",
  },
  {
    key: "principles",
    title: "The 11 Principles of AfrikaBurn",
    body: "I've read the principles (radical inclusion, gifting, decommodification, self-reliance, self-expression, communal effort, civic responsibility, leave no trace, participation, immediacy, each one teach one).",
  },
  {
    key: "ticket_plan",
    title: "AfrikaBurn ticket plan",
    body: "I understand the camp doesn't sell tickets. I'll get my own AfrikaBurn ticket through Quicket.",
  },
] as const;
export type DocKey = (typeof REQUIRED_DOCS)[number]["key"];
export const DOC_KEYS: readonly string[] = REQUIRED_DOCS.map((d) => d.key);

export type StepState = "done" | "current" | "todo" | "stopped";
export interface TrackerStep {
  key: "not_applied" | "applied" | "interview" | "accepted" | "joined";
  label: string;
  state: StepState;
  /** e.g. the interview date. */
  at?: Date | null;
}

const STEP_INDEX: Record<ApplicationStatus, number> = {
  draft: 0,
  applied: 1,
  interview_scheduled: 2,
  accepted: 3,
  joined: 4,
  declined: -1,
};

/** Not applied → Applied → Interview → Accepted → Joined, with where this application is. */
export function trackerSteps(app: JourneyFacts | null): TrackerStep[] {
  const steps: TrackerStep[] = [
    { key: "not_applied", label: "Not applied", state: "todo" },
    { key: "applied", label: "Applied", state: "todo" },
    { key: "interview", label: "Interview", state: "todo", at: app?.interviewAt ?? null },
    { key: "accepted", label: "Accepted", state: "todo" },
    { key: "joined", label: "Joined", state: "todo" },
  ];
  if (!app || app.status === "draft") {
    steps[0] = { ...steps[0], state: "current" } as TrackerStep;
    return steps;
  }
  if (app.status === "declined") {
    return steps.map((s, i) =>
      i === 0 ? { ...s, state: "done" } : i === 1 ? { ...s, state: "stopped" } : s,
    );
  }
  const at = STEP_INDEX[app.status];
  return steps.map((s, i) => ({
    ...s,
    state: i < at || (i === at && app.status === "joined") ? "done" : i === at ? "current" : "todo",
  }));
}

export interface TodoItem {
  key: string;
  label: string;
  done: boolean;
  /** Short line on what happens next. */
  hint?: string;
}

/** The applicant's to-do list: form, interview, each required document, the camp fee. */
export function todoList(app: JourneyFacts | null, formatFee: (cents: number) => string) {
  const sent = Boolean(app?.submittedAt);
  const interviewDone = Boolean(app?.interviewDoneAt);
  const items: TodoItem[] = [
    {
      key: "form",
      label: sent ? "Application sent" : "Fill in and send the application form",
      done: sent,
      hint: sent ? undefined : "Takes about 10 minutes. You can save a draft.",
    },
    {
      key: "interview",
      label: "Have a short interview with a lead",
      done: interviewDone,
      hint: interviewDone
        ? undefined
        : app?.interviewAt
          ? "Booked: see the date above."
          : "A lead will book it with you after you apply.",
    },
    ...REQUIRED_DOCS.map((d) => ({
      key: `doc:${d.key}`,
      label: `Confirm: ${d.title}`,
      done: Boolean(app?.docsDone.includes(d.key)),
    })),
    {
      key: "fee",
      label:
        app?.feeCents != null
          ? `Pay the camp fee (${formatFee(app.feeCents)})`
          : "Pay the camp fee",
      done: Boolean(app?.paidAt),
      hint: app?.paidAt
        ? undefined
        : app?.feeCents != null
          ? "The treasurer sends payment details. Demo: no real money; a finance lead marks it paid."
          : "Due once you're accepted.",
    },
  ];
  return items;
}

/** What still stands between this application and joining (empty = ready). */
export function missingForJoin(app: JourneyFacts): string[] {
  const missing: string[] = [];
  if (!app.submittedAt) missing.push("Application form");
  if (!app.interviewDoneAt || (app.status !== "accepted" && app.status !== "joined"))
    missing.push("Interview and acceptance");
  for (const d of REQUIRED_DOCS) if (!app.docsDone.includes(d.key)) missing.push(d.title);
  if (!app.paidAt) missing.push("Camp fee");
  return missing;
}

/** Joined = paid + every requirement done, including the interview (spec §2). */
export function readyToJoin(app: JourneyFacts): boolean {
  return app.status === "accepted" && missingForJoin(app).length === 0;
}

/** The statuses a lead may set (drafts and joined belong to the applicant and the app). */
export const LEAD_STATUSES = ["applied", "interview_scheduled", "accepted", "declined"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const MOVES: Record<ApplicationStatus, readonly LeadStatus[]> = {
  draft: [],
  applied: ["interview_scheduled", "declined"],
  interview_scheduled: ["interview_scheduled", "accepted", "declined"],
  accepted: ["declined"],
  joined: [],
  declined: ["applied"],
};

/** Statuses a lead may move this application to. */
export function leadMoves(from: ApplicationStatus): readonly LeadStatus[] {
  return MOVES[from];
}

/** Why a lead's status change isn't allowed, or null when it is. */
export function checkLeadMove(
  from: ApplicationStatus,
  to: LeadStatus,
  interviewAt: Date | null,
): string | null {
  if (!MOVES[from].includes(to))
    return `Can't move an application from ${label(from)} to ${label(to)}`;
  if (to === "interview_scheduled" && !interviewAt) return "Pick the interview date and time";
  return null;
}

const LABELS: Record<ApplicationStatus, string> = {
  draft: "Not applied",
  applied: "Applied",
  interview_scheduled: "Interview scheduled",
  accepted: "Accepted",
  joined: "Joined",
  declined: "Declined",
};

export function label(status: ApplicationStatus): string {
  return LABELS[status];
}

/** 350000 → "R3,500"; 432050 → "R4,320.50". Integer cents only. */
export function formatRand(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const part = Math.abs(cents) % 100;
  return `${cents < 0 ? "−" : ""}${MONEY_SYMBOL}${whole}${part ? `.${String(part).padStart(2, "0")}` : ""}`;
}
