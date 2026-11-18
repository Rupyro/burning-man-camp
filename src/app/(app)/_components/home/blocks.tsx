import Link from "next/link";
import type { CountdownPart } from "@/base/landing/home-rules";
import { dueChip } from "@/base/landing/home-rules";
import type { Tile } from "@/base/landing/landing";
import { formatCampDay, formatCampTime } from "@/lib/dates";
import { ModuleIcon } from "../../../_components/module-icon";
import { Chip } from "./chip";
import { HelpButtons } from "./help-buttons";

const card = "rounded-2xl border bg-card p-3 text-card-foreground";

export function Section(p: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={p.id} className="flex flex-col gap-2">
      <h2 id={p.id} className="heading text-sm">
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

export interface NextThing {
  id: string;
  title: string;
  sub: string;
  href: string;
  dueAt: Date | null;
}
export interface HelpRequest {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  personName: string;
}

export function NextThings(p: { items: NextThing[]; help: HelpRequest[]; now: Date }) {
  return (
    <Section id="next" title="My next things">
      {p.items.length === 0 && p.help.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for you right now.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {p.items.map((t) => {
          const chip = dueChip(t.dueAt, p.now);
          return (
            <li key={t.id}>
              <Link href={t.href} className={`${card} flex items-center justify-between gap-2`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{t.title}</span>
                  <small className="text-xs text-muted-foreground">{t.sub}</small>
                </span>
                {chip ? <Chip tone={chip.tone}>{chip.label}</Chip> : null}
              </Link>
            </li>
          );
        })}
        {p.help.map((h) => (
          <li
            key={h.assignmentId}
            className={`${card} flex items-center justify-between gap-2 border-2 border-dashed border-primary`}
          >
            <span className="min-w-0 text-sm">
              {h.personName} offered to help
              <Link href={`/tasks/${h.taskId}`} className="block truncate text-xs underline">
                “{h.taskTitle}”
              </Link>
            </span>
            <HelpButtons assignmentId={h.assignmentId} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Count({ part, label }: { part: CountdownPart; label: string }) {
  return (
    <div className="text-center">
      <b className="font-wordmark block text-5xl leading-none">{part.days}</b>
      <span className="heading block text-[10px]">{label}</span>
      <span className="block text-[11px] opacity-90">{formatCampDay(part.at, "d MMM yyyy")}</span>
    </div>
  );
}

export function Countdown(p: { build: CountdownPart | null; gates: CountdownPart | null }) {
  if (!p.build && !p.gates) return null;
  return (
    <section aria-label="Countdown" className="bg-sunset flex justify-around rounded-2xl px-4 py-5">
      {p.build ? <Count part={p.build} label="Days to build" /> : null}
      {p.gates ? <Count part={p.gates} label="Days to gates" /> : null}
    </section>
  );
}

export function NewForYou(p: {
  items: { id: string; title: string; href: string; createdAt: Date }[];
}) {
  return (
    <Section id="new" title="New for you">
      {p.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">You're all caught up.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {p.items.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className={`${card} flex items-start gap-2 text-sm`}>
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span>
                  {n.title}
                  <small className="block text-xs text-muted-foreground">
                    {formatCampTime(n.createdAt, "EEE d MMM, HH:mm")}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ModuleTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <Section id="modules" title="Modules">
      {tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No modules are open to you yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.id}>
              <Link
                href={t.route}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary p-2 text-center text-secondary-foreground"
              >
                <ModuleIcon name={t.icon} className="size-7" />
                <span className="heading text-[11px] leading-tight">{t.name}</span>
                {t.failed ? <span className="text-[10px]">Couldn't load</span> : null}
                {t.badge ? <Chip tone="late">{t.badge}</Chip> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** "Getting to camp" tiles (Nov 2026): the countdown and what to bring. */
export function GettingToCamp({ line }: { line: string | null }) {
  const tiles = [
    {
      href: "/countdown",
      title: "Countdown",
      note: line ?? "Days to build and what to do this week",
    },
    { href: "/bring", title: "What to bring", note: "Your packing list, and what camp provides" },
  ];
  return (
    <section aria-labelledby="getting-to-camp" className="flex flex-col gap-2">
      <h2 id="getting-to-camp" className="heading text-sm">
        Getting to camp
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-2xl border bg-card p-3 no-underline">
            <b className="text-sm">{t.title}</b>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t.note}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
