import Link from "next/link";
import { CAMP_GUIDE, can, type ModuleContext } from "@/base/api";
import { formatCampDay, formatCampTime } from "@/lib/dates";
import { handovers, shiftGaps } from "../../rules/burn";
import { dutyLeads, helpWall, myShifts, slotsOf } from "../../server/queries";
import { SavedBadge, TickList } from "../components/pack";

const time = (d: Date) => formatCampTime(d, "HH:mm");
const JUMPS = [
  ["help", "Help wall"],
  ["mine", "My shifts"],
  ["bring", "Bring"],
  ["info", "Camp info"],
] as const;

function Section(p: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${p.id}-h`} id={p.id} className="flex scroll-mt-16 flex-col gap-2">
      <h2 id={`${p.id}-h`} className="heading text-sm">
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

/** The paper HELP sheet: lines stay up once taken (crossed out), so it doubles as a wall of valor. */
function Paper({ lines }: { lines: Awaited<ReturnType<typeof helpWall>> }) {
  const heroes = [...new Set(lines.map((l) => l.takenBy))];
  return (
    <div
      className="rotate-[-0.6deg] rounded-sm p-4 text-pack-ink shadow-md"
      style={{
        background:
          "repeating-linear-gradient(var(--pack-paper) 0 27px, var(--pack-line) 27px 28px)",
      }}
    >
      <p className="heading text-base">HELP! Can't make my shift</p>
      <p className="mb-2 text-xs">
        The sheet hangs at the kitchen. Write your shift + name. Take one? Write your name and cross
        the line out. Lines stay up.
      </p>
      {lines.length ? (
        <ul className="flex flex-col text-sm leading-7">
          {lines.map((l) => (
            <li key={l.signupId} className="flex justify-between gap-2">
              <span className="line-through decoration-2">
                {formatCampDay(l.startsAt, "EEE")} {l.dutyName} {time(l.startsAt)}
              </span>
              <span className="font-semibold italic">✓ {l.takenBy}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-7">No lines recorded yet. Leads copy taken lines in here.</p>
      )}
      {heroes.length ? (
        <p className="mt-2 text-xs italic">Wall of valor: {heroes.join(", ")}</p>
      ) : null}
    </div>
  );
}

/** One line per lead, listing the duties they lead. */
function byLead(rows: readonly { duty: string; lead: string }[]) {
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.lead, [...(out.get(r.lead) ?? []), r.duty]);
  return [...out];
}

/** Leads at camp keep a minimal toolset: which shifts are short, and the next handovers. */
function LeadTools({ slots, now }: { slots: Awaited<ReturnType<typeof slotsOf>>; now: Date }) {
  const gaps = shiftGaps(slots, now);
  const next = handovers(slots, now);
  const row = "flex min-h-11 items-center justify-between gap-2 border-t py-1";
  return (
    <div className="rounded-2xl border bg-card p-3 text-sm">
      <p className="font-semibold">Shift gaps</p>
      <ul>
        {gaps.length ? (
          gaps.map((g) => (
            <li key={g.id}>
              <Link href={`/shifts/s/${g.id}`} className={row}>
                <span>
                  {g.dutyName} · {formatCampDay(g.startsAt, "EEE")} {time(g.startsAt)}
                </span>
                <span className="font-semibold">{g.short} short</span>
              </Link>
            </li>
          ))
        ) : (
          <li className={row}>Every shift has its crew.</li>
        )}
      </ul>
      <p className="mt-2 font-semibold">Handovers</p>
      <ul>
        {next.length ? (
          next.map(({ from, to }) => (
            <li key={`${from.id}-${to.id}`}>
              <Link href={`/shifts/s/${to.id}`} className={row}>
                <span>
                  {from.dutyName} → {to.dutyName}
                </span>
                <span className="font-semibold">
                  {formatCampDay(to.startsAt, "EEE")} {time(to.startsAt)}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className={row}>No handovers coming up.</li>
        )}
      </ul>
    </div>
  );
}

/** Burn pack (option A): one scroll for camp, saved on the phone so it works without signal. */
export async function PackPage({ ctx }: { ctx: ModuleContext }) {
  const me = ctx.actor.personId;
  const lead = can(ctx.actor, "shifts.manage") || ctx.actor.teams.some((t) => t.role !== "member");
  const [mine, wall, leads, slots] = await Promise.all([
    me ? myShifts(ctx.db, ctx.edition.id, me) : [],
    helpWall(ctx.db, ctx.edition.id),
    dutyLeads(ctx.db, ctx.edition.id),
    lead ? slotsOf(ctx.db, ctx.edition.id) : [],
  ]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <header className="bg-sunset rounded-2xl p-5">
        <h1 className="heading text-lg">Burn pack</h1>
        <p className="mt-1 text-sm">Everything you need at camp, on one page.</p>
      </header>
      <SavedBadge updated={formatCampDay(ctx.now, "d MMM")} />
      <nav
        aria-label="Jump to"
        className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
      >
        {JUMPS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border bg-card px-4 text-sm font-semibold"
          >
            {label}
          </a>
        ))}
      </nav>
      {lead ? (
        <Section id="lead" title="Your duty at camp">
          <LeadTools slots={slots} now={ctx.now} />
        </Section>
      ) : null}
      <Section id="help" title="Help wall">
        <Paper lines={wall} />
      </Section>
      <Section id="mine" title="My shifts">
        {mine.length ? (
          <ul className="flex flex-col gap-2">
            {mine.map((s) => (
              <li key={s.signupId} className="rounded-2xl border bg-card p-3">
                <p className="font-semibold">{s.dutyName}</p>
                <p className="text-sm">
                  {formatCampDay(s.startsAt, "EEE d MMM")} {time(s.startsAt)}–{time(s.endsAt)}
                </p>
                <p className="mt-1 text-xs">Can't make it? Use the HELP sheet at the kitchen.</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border bg-card p-3 text-sm">No shifts yet.</p>
        )}
      </Section>
      <Section id="bring" title="What to bring">
        <TickList items={CAMP_GUIDE.packing} />
      </Section>
      <Section id="info" title="Camp info">
        <div className="rounded-2xl border bg-card p-3 text-sm">
          <p className="font-semibold">Who to find</p>
          <ul className="mt-1 flex flex-col gap-1">
            {byLead(leads).map(([lead, duties]) => (
              <li key={lead}>
                <strong>{lead}:</strong> {duties.join(", ")}
              </li>
            ))}
            <li>
              <strong>Anything else:</strong> Camp leads at the HQ tent
            </li>
          </ul>
          <p className="mt-2 font-semibold">Camp rules</p>
          <ul className="mt-1 list-disc pl-5">
            {CAMP_GUIDE.rules.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
