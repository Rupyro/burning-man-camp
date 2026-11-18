// The home "Up next" queue (docs/specs/b3-home-up-next.md §1–2): pure ranking and row building.
import type { MyItem } from "../registry/types";
import { type ChipTone, dueChip } from "./home-rules";

export type Tier = 0 | 1 | 2;
export type QueueKind =
  | "task"
  | "approval"
  | "alert"
  | "ride"
  | "deadline"
  | "handover"
  | "other"
  | "help"
  | "late"
  | "blocked";

export interface TeamTask {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
  ownerName: string | null;
  projectName: string;
}

export interface TeamPulse {
  teamId: string;
  name: string;
  done: number;
  total: number;
  percent: number;
  late: number;
  blocked: number;
  /** Late first (oldest due first), then blocked; capped by the query. */
  tasks: TeamTask[];
}

export interface QueueItem {
  id: string;
  kind: QueueKind;
  title: string;
  sub: string;
  href: string;
  tier: Tier;
  at: Date | null;
  chip?: { label: string; tone: ChipTone | "blocked" };
  action: string;
  help?: { assignmentId: string };
  tasks?: TeamTask[];
}

const toneTier = (tone: ChipTone | undefined): Tier =>
  tone === "late" ? 0 : tone === "soon" ? 1 : 2;

/** Urgency tier first, then soonest date (undated last), then title so the order is stable. */
export function rankQueue(items: readonly QueueItem[], cap = 5) {
  const all = [...new Map(items.map((i) => [i.id, i])).values()].sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.at?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.at?.getTime() ?? Number.POSITIVE_INFINITY) ||
      a.title.localeCompare(b.title),
  );
  return { shown: all.slice(0, cap), total: all.length, all };
}

export interface MyTaskRow {
  id: string | null;
  title: string | null;
  projectName: string | null;
  dueAt: Date | null;
  status?: string | null;
}

export function fromMyTask(t: MyTaskRow, now: Date): QueueItem {
  const due = dueChip(t.dueAt, now) ?? undefined;
  const blocked = t.status === "blocked";
  const chip = blocked ? { label: "Blocked", tone: "blocked" as const } : due;
  return {
    id: `task:${t.id}`,
    kind: "task",
    title: t.title ?? "",
    sub: t.projectName ?? "",
    href: `/tasks/${t.id}`,
    tier: blocked ? 1 : toneTier(due?.tone),
    at: t.dueAt,
    chip,
    action: "Open",
  };
}

const ACTION: Record<MyItem["kind"], string> = {
  approval: "Review",
  alert: "Check",
  deadline: "Check",
  handover: "Sort it out",
  ride: "Open",
  shift: "Open",
  other: "Open",
};

/**
 * A module's "my stuff" item. Approvals and handovers wait on someone, so they are never below
 * "soon". A handover's line under the title says why the system stopped.
 */
export function fromModuleItem(i: MyItem, moduleName: string, now: Date): QueueItem {
  const chip = dueChip(i.dueAt ?? null, now) ?? undefined;
  const tier: Tier =
    i.urgency === "overdue"
      ? 0
      : i.urgency === "soon" || i.kind === "approval" || i.kind === "handover"
        ? 1
        : 2;
  return {
    id: `${i.moduleId}:${i.id}`,
    kind: i.kind === "shift" ? "other" : i.kind,
    title: i.title,
    sub: i.reason ? `${moduleName} · ${i.reason}` : moduleName,
    href: i.href,
    tier,
    at: i.dueAt ?? null,
    chip,
    action: ACTION[i.kind],
  };
}

export function fromHelp(h: {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  personName: string;
}): QueueItem {
  return {
    id: `help:${h.assignmentId}`,
    kind: "help",
    title: `${h.personName.split(" (")[0]} offered to help`,
    sub: `“${h.taskTitle}”`,
    href: `/tasks/${h.taskId}`,
    tier: 0,
    at: null,
    action: "Accept or decline",
    help: { assignmentId: h.assignmentId },
  };
}

/** One summary row per team with late or blocked work: "Kitchen: 3 late". */
export function teamRows(teams: readonly TeamPulse[], now: Date): QueueItem[] {
  const rows: QueueItem[] = [];
  for (const t of teams) {
    if (t.late === 0 && t.blocked === 0) continue;
    const oldest = t.tasks.find((x) => x.status !== "blocked" && x.dueAt)?.dueAt ?? null;
    const chip = oldest ? dueChip(oldest, now) : null;
    const extra = [
      t.late && t.blocked ? `${t.blocked} blocked` : null,
      chip ? `oldest ${chip.label}` : null,
    ].filter(Boolean);
    rows.push({
      id: `team:${t.teamId}`,
      kind: t.late ? "late" : "blocked",
      title: t.late ? `${t.name}: ${t.late} late` : `${t.name}: ${t.blocked} blocked`,
      sub: extra.length ? extra.join(" · ") : "Waiting on something",
      href: `/up-next#team-${t.teamId}`,
      tier: t.late ? 0 : 1,
      at: oldest,
      chip: t.late
        ? { label: `${t.late} late`, tone: "late" }
        : { label: `${t.blocked} blocked`, tone: "blocked" },
      action: "See tasks",
      tasks: t.tasks,
    });
  }
  return rows;
}

export interface QueueInput {
  now: Date;
  mine: readonly MyTaskRow[];
  moduleItems: readonly MyItem[];
  moduleName: (moduleId: string) => string;
  help: readonly Parameters<typeof fromHelp>[0][];
  teams: readonly TeamPulse[] | null;
}

/** Everything that needs the caller, as queue rows. Tasks counted in a team row aren't repeated. */
export function buildQueue(input: QueueInput): QueueItem[] {
  const inTeamRows = new Set((input.teams ?? []).flatMap((t) => t.tasks.map((x) => x.id)));
  return [
    ...teamRows(input.teams ?? [], input.now),
    ...input.help.map(fromHelp),
    ...input.mine
      .filter((t) => !(t.id && inTeamRows.has(t.id)))
      .map((t) => fromMyTask(t, input.now)),
    ...input.moduleItems.map((i) => fromModuleItem(i, input.moduleName(i.moduleId), input.now)),
  ];
}

export interface ProfileBasics {
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  arrival: Date | null;
}

/** My to-do: one "Fill in your details" row to /me while the basics camp needs are missing. */
export function profileRow(p: ProfileBasics): QueueItem | null {
  const missing = [
    p.phone.trim() ? null : "your phone",
    p.emergencyName.trim() && p.emergencyPhone.trim() ? null : "an emergency contact",
    p.arrival ? null : "your arrival date",
  ].filter((m): m is string => m !== null);
  if (!missing.length) return null;
  return {
    id: "profile:details",
    kind: "other",
    title: "Fill in your details",
    sub: `Missing: ${missing.join(", ")}`,
    href: "/me",
    tier: 1,
    at: null,
    action: "Fill in",
  };
}

/** "12 days to build · 40 to gates", hiding a missing half; null when neither date is set. */
export function countdownLine(build: { days: number } | null, gates: { days: number } | null) {
  if (build && gates) return `${build.days} days to build · ${gates.days} to gates`;
  if (build) return `${build.days} days to build`;
  if (gates) return `${gates.days} days to gates`;
  return null;
}
