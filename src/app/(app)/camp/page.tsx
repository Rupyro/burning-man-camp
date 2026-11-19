import Link from "next/link";
import { can } from "@/base/authz/permissions";
import { listAnchorDates } from "@/base/editions/settings";
import { CAMP_GUIDE, leadContacts } from "@/base/landing/camp-info";
import { listDirectory } from "@/base/people/directory";
import { hasPack } from "@/lib/active-packs";
import { formatCampDay } from "@/lib/dates";
import { EVENT, EVENT_NAME } from "@/lib/event";
import { basePage } from "../_components/base-page";

function Block(p: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={p.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <h2 id={p.id} className="heading text-sm">
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

const list = (items: readonly string[]) => (
  <ul className="list-disc space-y-1 pl-5 text-sm">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

/** Camp info (spec B3.1 §4): guide, packing, rules, key dates and who leads what. */
/** Licensing and registration steps for the camp's vehicle and art packs. */
const projects = (EVENT.projects ?? []).filter((p) => hasPack(p.pack));

export default async function CampInfoPage() {
  const { dates, leads } = await basePage(async (ctx) => ({
    dates: await listAnchorDates(ctx.db, ctx.edition.id),
    leads: can(ctx.actor, "member.view_directory") ? leadContacts(await listDirectory(ctx)) : null,
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Camp info</h1>
      <p className="text-sm text-muted-foreground">
        Draft text: the leads will replace it with the camp's own guide.
      </p>
      <Link href="/camp/ask" className="text-sm font-semibold underline">
        Ask the guide a question
      </Link>
      <Block id="guide" title="Member guide">
        {list(CAMP_GUIDE.guide)}
      </Block>
      <Block id="packing" title="Packing list">
        {list(CAMP_GUIDE.packing)}
      </Block>
      <Block id="rules" title="Camp rules">
        {list(CAMP_GUIDE.rules)}
      </Block>
      {EVENT.firstTimer?.length ? (
        <Block id="first-timer" title={`First time at ${EVENT_NAME}?`}>
          <p className="text-sm">Read these before you go, in this order:</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {EVENT.firstTimer.map((l) => (
              <li key={l.url}>
                <a href={l.url} className="underline" target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ol>
        </Block>
      ) : null}
      {projects.length ? (
        <Block id="projects" title="Vehicles and art">
          {projects.map((p) => (
            <div key={p.pack} className="text-sm">
              <b>{p.label}.</b> {p.summary}
              <ul className="mt-1 list-disc pl-5">
                {p.steps.map((s) => (
                  <li key={s.label}>
                    {s.label}: {s.window}
                  </li>
                ))}
              </ul>
              <a href={p.source} className="underline" target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          ))}
        </Block>
      ) : null}
      {EVENT.rules.length ? (
        <Block id="event-rules" title={`${EVENT_NAME}'s rules for camps`}>
          <ul className="flex flex-col gap-2 text-sm">
            {EVENT.rules.map((r) => (
              <li key={r.key}>
                <b>{r.label}.</b> {r.summary}{" "}
                <a href={r.source} className="underline" target="_blank" rel="noreferrer">
                  Source
                </a>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      <Block id="dates" title="Key dates">
        {dates.length ? (
          <ul className="space-y-1 text-sm">
            {dates.map((d) => (
              <li key={d.key} className="flex justify-between gap-2">
                <span>{d.label}</span>
                <span className="font-semibold">{formatCampDay(d.startsAt, "EEE d MMM yyyy")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">No dates set yet.</p>
        )}
        <Link href="/obligations" className="text-sm underline">
          {EVENT_NAME} deadlines
        </Link>
        <Link href="/year" className="text-sm underline">
          The whole {EVENT_NAME} year
        </Link>
        <Link href="/countdown" className="text-sm underline">
          Countdown to build and the burn
        </Link>
        <Link href="/water" className="text-sm underline">
          Water plan
        </Link>
        <Link href="/fuel" className="text-sm underline">
          Fuel plan
        </Link>
        <Link href="/playa-binder" className="text-sm underline">
          Playa binder (print before you go)
        </Link>
      </Block>
      <Block id="leads" title="Lead contacts">
        {leads?.length ? (
          <ul className="space-y-1 text-sm">
            {leads.map((l) => (
              <li key={`${l.team}-${l.personId}`} className="flex justify-between gap-2">
                <span>
                  {l.team} {l.role === "lead" ? "lead" : "co-lead"}
                </span>
                <Link href={`/people/${l.personId}`} className="font-semibold underline">
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Ask in the camp WhatsApp group who leads each team.</p>
        )}
      </Block>
    </div>
  );
}
