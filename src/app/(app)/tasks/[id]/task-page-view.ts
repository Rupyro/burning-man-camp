// Pure helpers for the task page (spec S3). They only decide what to show; every action is
// re-checked on the server.
import { campInputToInstant } from "@/lib/dates";

type Get = (key: string) => string;
type Helper = { personId: string; status: "active" | "pending_approval" | string };
type Mode = "closed" | "open" | "open_with_approval";

export function helperControls(helper: Helper, me: string | undefined, canManage: boolean) {
  const mine = helper.personId === me;
  return {
    decide: canManage && !mine && helper.status === "pending_approval",
    leave: mine,
    remove: canManage && !mine,
  };
}

export function canClaim(
  task: { claimMode: Mode; open: boolean; ownerPersonId: string | null },
  helpers: readonly Helper[],
  me: string | undefined,
) {
  if (!me || task.claimMode === "closed" || !task.open || task.ownerPersonId === me) return false;
  return !helpers.some((h) => h.personId === me);
}

export const canTick = (canEdit: boolean, helpers: readonly Helper[], me: string | undefined) =>
  canEdit || helpers.some((h) => h.personId === me && h.status === "active");

export const STATUS_CHOICES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled (leads)" },
] as const;

export function readStatusForm(get: Get) {
  const status = STATUS_CHOICES.find((s) => s.value === get("status"))?.value;
  if (!status) return { ok: false as const, error: "Pick a status." };
  const reason = get("blockedReason").trim();
  if (status === "blocked" && !reason)
    return { ok: false as const, error: "Say why it's blocked." };
  return {
    ok: true as const,
    input: { status, blockedReason: status === "blocked" ? reason : null },
  };
}

export function readDueForm(get: Get) {
  const date = get("dueDate");
  return { dueAt: date ? campInputToInstant(date, get("dueTime")).toISOString() : null };
}

export const MODE_CHOICES = [
  { value: "closed", label: "Not open for helpers" },
  { value: "open", label: "Anyone confirmed can join" },
  { value: "open_with_approval", label: "Anyone can ask; a lead approves" },
] as const;

export function readClaimModeForm(get: Get) {
  const claimMode = MODE_CHOICES.find((m) => m.value === get("claimMode"))?.value;
  if (!claimMode) return { ok: false as const, error: "Pick who can help." };
  const raw = get("claimCapacity").trim();
  const n = Number(raw);
  if (raw && !Number.isInteger(n))
    return { ok: false as const, error: "Helpers needed must be a whole number." };
  return { ok: true as const, input: { claimMode, claimCapacity: raw ? n : null } };
}
