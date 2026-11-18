import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { QueueItem, QueueKind, TeamPulse, TeamTask } from "@/base/landing/home-queue";
import { dueChip } from "@/base/landing/home-rules";
import { ModuleIcon } from "../../../_components/module-icon";
import { Chip } from "./chip";
import { HelpButtons } from "./help-buttons";

const KIND_ICON: Record<QueueKind, string> = {
  task: "square-check-big",
  approval: "stamp",
  alert: "triangle-alert",
  ride: "car",
  deadline: "hourglass",
  handover: "hand",
  other: "circle-dot",
  help: "heart-handshake",
  late: "alarm-clock",
  blocked: "octagon-pause",
};

/** My to-do (spec B3.1 §1–2, B3.2): a few ranked rows, each one tap to where you do it. */
export function UpNext(p: {
  items: QueueItem[];
  total: number;
  title: string;
  now: Date;
  /** Hides the "See all" link (on the See all page itself). */
  full?: boolean;
  /** Extra control next to the title (the lead's phone readiness icon). */
  tools?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="up-next" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="up-next" className="heading text-sm">
          {p.title}
        </h2>
        <span className="flex shrink-0 items-center gap-3">
          {p.tools}
          {p.full ? null : (
            <Link
              href="/up-next"
              className="whitespace-nowrap text-sm font-semibold underline underline-offset-2 hover:no-underline"
            >
              See all ({p.total})
            </Link>
          )}
        </span>
      </div>
      {p.items.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">
          You're all set. Nothing needs you right now.
        </p>
      ) : (
        <ol className="rounded-2xl border bg-card p-1">
          {p.items.map((i) => (
            <li key={i.id} className="border-b border-border/70 last:border-b-0">
              <QueueRow item={i} now={p.now} open={p.full} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RowBody({ item: i }: { item: QueueItem }) {
  const urgent = i.tier === 0;
  return (
    <>
      <span
        aria-hidden
        className={`grid size-10 shrink-0 place-items-center rounded-full ${urgent ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground ring-1 ring-border"}`}
      >
        <ModuleIcon name={KIND_ICON[i.kind]} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug font-semibold">{i.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {i.sub}
          {i.chip && i.kind !== "late" && i.kind !== "blocked" ? (
            <Chip tone={i.chip.tone}>{i.chip.label}</Chip>
          ) : null}
        </span>
      </span>
    </>
  );
}

const pill = "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground";

function QueueRow({ item: i, now, open }: { item: QueueItem; now: Date; open?: boolean }) {
  if (i.tasks) {
    return (
      <details id={i.id.replace(":", "-")} open={open} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          <RowBody item={i} />
          <span className={pill}>{i.action}</span>
          <ChevronDown aria-hidden className="size-4 opacity-60 group-open:rotate-180" />
        </summary>
        <TeamTasks tasks={i.tasks} now={now} />
      </details>
    );
  }
  if (i.help) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-3">
        <RowBody item={i} />
        <HelpButtons assignmentId={i.help.assignmentId} />
      </div>
    );
  }
  return (
    <Link href={i.href} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/60">
      <RowBody item={i} />
      <span className={pill}>{i.action}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 opacity-60" />
    </Link>
  );
}

function TeamTasks({ tasks, now }: { tasks: TeamTask[]; now: Date }) {
  return (
    <ul className="mx-3 mb-3 flex flex-col gap-1 border-l-2 border-primary/40 pl-3">
      {tasks.map((t) => {
        const chip =
          t.status === "blocked"
            ? { label: "Blocked", tone: "blocked" as const }
            : dueChip(t.dueAt, now);
        return (
          <li key={t.id}>
            <Link
              href={`/tasks/${t.id}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block [overflow-wrap:anywhere]">{t.title}</span>
                <small className="text-xs text-muted-foreground">
                  {t.ownerName ?? "Nobody yet"} · {t.projectName}
                </small>
              </span>
              {chip ? <Chip tone={chip.tone}>{chip.label}</Chip> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Team readiness: done / live tasks per team, with the late count. */
export function ReadinessList({ teams }: { teams: TeamPulse[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {teams.map((t) => (
        <li key={t.teamId} className="text-sm">
          <span className="flex justify-between gap-2">
            <span className="font-semibold">{t.name}</span>
            <span>
              {t.percent}% · {t.done}/{t.total}
              {t.late ? ` · ${t.late} late` : ""}
            </span>
          </span>
          <span
            className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`${t.name} readiness`}
            aria-valuenow={t.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-bar-from to-bar-to"
              style={{ width: `${t.percent}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  href: string;
  line: string;
  badge?: number | null;
  isNew?: boolean;
}

/** The category cards; all detail lives behind them. */
export function CategoryGrid({ cards, lead }: { cards: Category[]; lead?: boolean }) {
  return (
    <section aria-labelledby="categories" className="flex flex-col gap-2">
      <h2 id="categories" className="heading text-xs text-muted-foreground">
        Everything else
      </h2>
      <ul className={`grid grid-cols-2 gap-2 ${lead ? "lg:grid-cols-3" : "sm:grid-cols-3"}`}>
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={c.href}
              className={`flex h-full min-h-20 flex-col gap-1.5 rounded-2xl border p-3 opacity-90 hover:opacity-100 ${c.isNew ? "bg-sunset border-transparent" : "bg-secondary text-secondary-foreground"} ${lead ? "lg:p-4" : ""}`}
            >
              <span className="flex items-start justify-between gap-2">
                <ModuleIcon name={c.icon} className="size-5" />
                {c.badge ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-late px-1.5 text-xs font-bold text-late-foreground">
                    {c.badge}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : c.isNew ? (
                  <span className="rounded-full bg-ochre px-2 py-0.5 text-[10px] font-bold text-earth">
                    New
                  </span>
                ) : null}
              </span>
              <span className="heading text-[13px] leading-tight">{c.name}</span>
              <span className="text-xs leading-snug">{c.line}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
