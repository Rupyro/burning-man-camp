import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { formatCampDay, formatCampTime, instantToCampInput } from "@/lib/dates";
import { claimProblem } from "../../rules/contribution";
import { notOpenYet } from "../../rules/opening";
import {
  myContribution,
  myShifts,
  mySkillIds,
  settingsOf,
  signupsOpenAt,
  slotsOf,
} from "../../server/queries";
import { ClaimButton } from "../components/actions";

const time = (d: Date) => formatCampTime(d, "HH:mm");

/** Shifts home: my contribution, my shifts, and open shifts I can claim (qualified only). */
export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const me = ctx.actor.personId;
  const settings = await settingsOf(ctx.db, ctx.edition.id);
  if (!settings || !me)
    return (
      <header className="bg-sunset rounded-2xl p-5">
        <h1 className="heading text-lg">Shifts</h1>
        <p className="mt-1 text-sm">
          {notOpenYet(await signupsOpenAt(ctx.db, ctx.edition.id), ctx.now)}
        </p>
      </header>
    );
  const [slots, mine, skills, c] = await Promise.all([
    slotsOf(ctx.db, ctx.edition.id),
    myShifts(ctx.db, ctx.edition.id, me),
    mySkillIds(ctx.db, me),
    myContribution(ctx.db, ctx.edition.id, me),
  ]);
  const mayClaim = can(ctx.actor, "shifts.claim");
  const frozen = ctx.now >= settings.freezeAt;
  const onSlot = new Set(mine.map((m) => m.slotId));
  const open = slots.filter(
    (s) =>
      !onSlot.has(s.id) &&
      claimProblem({
        now: ctx.now,
        freezeAt: settings.freezeAt,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        slotStatus: s.status,
        liveCount: s.liveCount,
        maxStaff: s.maxStaff,
        requiredSkillId: s.requiredSkillId,
        mySkillIds: skills,
        alreadyOn: false,
        myShifts: [],
      }) === null,
  );
  /** One of my shifts this open slot overlaps; the server refuses the claim, so say so up front. */
  const clashOf = (s: { startsAt: Date; endsAt: Date }) =>
    mine.find((m) => m.startsAt < s.endsAt && s.startsAt < m.endsAt);
  const byDay = new Map<string, typeof open>();
  for (const s of open) {
    const day = instantToCampInput(s.startsAt).date;
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="bg-sunset rounded-2xl p-5">
        <h1 className="heading text-lg">Shifts</h1>
        <p className="mt-1 text-sm">
          {frozen
            ? `Sign-ups closed on ${formatCampDay(settings.freezeAt)}. Ask the duty lead about changes.`
            : `Pick your shifts before sign-up closes on ${formatCampDay(settings.freezeAt)}.`}
        </p>
        <Link
          href="/shifts/pack"
          className="mt-3 inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-semibold"
        >
          🎒 Burn pack: save it on your phone for camp
        </Link>
      </header>

      {c ? (
        <section aria-labelledby="contrib" className="rounded-2xl border bg-card p-4">
          <h2 id="contrib" className="heading text-sm">
            My contribution
          </h2>
          <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <strong>Camp duties:</strong> {c.dutyHoursPlanned} of {c.minDutyHours} hours signed up
              {c.precreditHours ? `, plus ${c.precreditHours} h pre-Burn credit` : ""}.{" "}
              {c.dutyHoursDone} h recorded done.
            </li>
            <li>
              <strong>Build and strike:</strong> {c.buildStrikeDaysPlanned} of{" "}
              {c.minBuildStrikeDays} days signed up. {c.buildStrikeDaysDone} recorded done.
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Shifts count once a lead records them as done after the Burn.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="mine" className="flex flex-col gap-2">
        <h2 id="mine" className="heading text-sm">
          What I've signed up for
        </h2>
        {mine.length ? (
          <ul className="flex flex-col gap-2">
            {mine.map((m) => (
              <li key={m.signupId}>
                <Link
                  href={`/shifts/s/${m.slotId}`}
                  className="flex min-h-11 items-center justify-between rounded-2xl border bg-card p-3"
                >
                  <span className="font-semibold">{m.dutyName}</span>
                  <span className="text-sm">
                    {formatCampDay(m.startsAt, "EEE d MMM")} {time(m.startsAt)}–{time(m.endsAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">You haven't claimed anything yet.</p>
        )}
      </section>

      <section aria-labelledby="open" className="flex flex-col gap-3">
        <h2 id="open" className="heading text-sm">
          Open slots you can claim
        </h2>
        {!open.length ? (
          <p className="text-sm">
            {frozen
              ? "Sign-ups are closed."
              : "No open shifts match your qualifications right now."}
          </p>
        ) : (
          [...byDay].map(([day, list]) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                {formatCampDay(list[0]?.startsAt ?? new Date(day), "EEEE d MMM")}
              </h3>
              <ul className="flex flex-col gap-2">
                {list.map((s) => {
                  const clash = clashOf(s);
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border bg-card p-3${clash ? " opacity-60" : ""}`}
                    >
                      <Link href={`/shifts/s/${s.id}`} className="flex flex-col">
                        <span className="font-semibold underline">{s.dutyName}</span>
                        <span className="text-sm">
                          {time(s.startsAt)}–{time(s.endsAt)} · {s.liveCount} of {s.maxStaff}
                          {s.liveCount < s.minStaff
                            ? ` (needs ${s.minStaff - s.liveCount} more)`
                            : ""}
                          {s.skillLabel ? ` · needs ${s.skillLabel}` : ""}
                        </span>
                      </Link>
                      {clash ? (
                        <span className="max-w-32 text-right text-xs">
                          Clashes with your {clash.dutyName}
                        </span>
                      ) : mayClaim ? (
                        <ClaimButton slotId={s.id} label={s.dutyName} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
