// Pure helpers for the task screens: labels and reading forms, so the .tsx stays thin.
import { campInputToInstant, formatCampTime } from "@/lib/dates";

type Get = (key: string) => string;
type Status = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

const when = (at: Date) => formatCampTime(at, "EEE d MMM, HH:mm");

export function dueLabel(dueAt: Date | null, urgency: "overdue" | "soon" | "normal"): string {
  if (!dueAt) return "No due date";
  if (urgency === "overdue") return `Overdue · was due ${when(dueAt)}`;
  if (urgency === "soon") return `Due soon · ${when(dueAt)}`;
  return `Due ${when(dueAt)}`;
}

const STATUS: Record<Status, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};
export const statusLabel = (s: Status | null) => STATUS[s ?? "todo"];

export function roomLabel(helpers: number, cap: number | null): string {
  if (cap !== null) return `${helpers} of ${cap} helpers`;
  if (helpers === 0) return "No helpers yet";
  return helpers === 1 ? "1 helper" : `${helpers} helpers`;
}

export const claimLabel = (mode: "open" | "open_with_approval" | "closed") =>
  mode === "open_with_approval" ? "Ask to help" : "Claim";

const TYPES: Record<string, string> = {
  "task.assigned": "Assigned to me",
  "claim.decided": "My claims decided",
  "task.comment": "New comments on tasks I watch",
  "task.due_soon": "Due soon",
  "task.overdue": "Overdue",
  "task.stalled": "Gone quiet",
  "task.unowned": "Tasks with no owner",
  "task.dependency_risk": "At risk",
  "task.nudge": "Nudges from my team lead",
};
export const typeLabel = (type: string) => TYPES[type] ?? type;

export const CHANNEL_CHOICES = [
  { value: "in_app", label: "In the app only" },
  { value: "email_immediate", label: "Email me straight away" },
  { value: "email_digest", label: "In my daily email" },
  { value: "off", label: "Off" },
] as const;

/** The add-task form → newTask input. "takeIt" makes the caller the owner. */
export function readTaskForm(projectId: string, get: Get, myPersonId?: string) {
  const title = get("title").trim();
  if (!title) return { ok: false as const, error: "Give the task a title." };
  const date = get("dueDate");
  const input: { projectId: string; title: string; dueAt?: string; ownerPersonId?: string } = {
    projectId,
    title,
  };
  if (date) input.dueAt = campInputToInstant(date, get("dueTime")).toISOString();
  if (get("takeIt") === "on" && myPersonId) input.ownerPersonId = myPersonId;
  return { ok: true as const, input };
}

export function readPreferenceForm(get: Get) {
  const channel = CHANNEL_CHOICES.find((c) => c.value === get("channel"))?.value;
  if (!channel) return { ok: false as const, error: "Pick how you want to hear about it." };
  return { ok: true as const, input: { type: get("type"), channel } };
}
