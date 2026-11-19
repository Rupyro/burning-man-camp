import { CAMP_GUIDE } from "@/base/landing/camp-info";
import { activeEvent } from "@/lib/active-packs";
import { CAMP_NAME } from "@/lib/camp";
import { EXODUS_PLAN, LNT_PLAN } from "@/lib/camp-content";
import { CAMP_TZ_LABEL, formatCampDay } from "@/lib/dates";
import { dayInstant } from "@/lib/year-calendar";
import { basePage } from "../_components/base-page";
import { PrintButton } from "./print-button";

const ON_SITE = new Set([
  "box_office_early",
  "gates_open",
  "man_burn",
  "temple_burn",
  "event_ends",
  "off_playa",
]);

function Part(p: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border bg-card p-4 print:border-0 print:p-0">
      <h2 className="heading text-sm">{p.title}</h2>
      {p.children}
    </section>
  );
}

const list = (items: readonly string[]) => (
  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

/** The playa binder (plan Phase 8): one printable page for camp, with no signal needed. */
export default async function PlayaBinderPage() {
  await basePage(async () => null);
  const e = activeEvent;
  const day = (d: string) => formatCampDay(dayInstant(d), "EEE d MMM");
  const onSite = e.calendar.filter((c) => ON_SITE.has(c.key));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="heading text-lg">
            {CAMP_NAME} playa binder: {e.words.name} {e.year}
          </h1>
          <p className="text-sm text-muted-foreground">
            {e.place}
            {e.event ? ` · ${day(e.event.start)} – ${day(e.event.end)}` : ""} · times in{" "}
            {CAMP_TZ_LABEL}. Print it or save it as a PDF before you lose signal.
          </p>
        </div>
        <PrintButton />
      </div>
      {onSite.length ? (
        <Part title="On site: the dates that matter">
          <ul className="mt-1 space-y-1 text-sm">
            {onSite.map((c) => (
              <li key={c.key} className="flex justify-between gap-2">
                <span>{c.label}</span>
                <b>
                  {day(c.date)}
                  {c.time ? `, ${c.time}` : ""}
                </b>
              </li>
            ))}
          </ul>
        </Part>
      ) : null}
      <Part title="Camp rules">{list(CAMP_GUIDE.rules)}</Part>
      <Part title="Leave No Trace">{list(LNT_PLAN)}</Part>
      <Part title="Exodus">{list(EXODUS_PLAN)}</Part>
      {e.rules.length ? (
        <Part title={`${e.words.name}'s rules for camps`}>
          {list(e.rules.map((r) => `${r.label}: ${r.summary}`))}
        </Part>
      ) : null}
    </div>
  );
}
