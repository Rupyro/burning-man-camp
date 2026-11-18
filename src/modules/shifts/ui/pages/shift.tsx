import Link from "next/link";
import { notFound } from "next/navigation";
import type { ModuleContext } from "@/base/api";
import { formatCampDay, formatCampTime } from "@/lib/dates";
import { shiftCard, standbyActivity } from "../../server/queries";
import { StandbyControls, TickBox } from "../components/actions";

const SECTION: Record<string, string> = {
  before: "Before you start",
  setup: "Setup",
  during: "During the shift",
  cleanup: "Clean-up",
  resources: "Resources and waste",
  final: "Final",
};
const time = (d: Date) => formatCampTime(d, "HH:mm");

/** The shift card: what it involves, the lead, who's on it and the tickable checklist. */
export async function ShiftPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  const card = await shiftCard(ctx.db, ctx.edition.id, id);
  if (!card) notFound();
  const { slot, duty, crew, checklist } = card;
  const onIt = crew.some((c) => c.personId === ctx.actor.personId);
  const sections = [...new Set(checklist.map((i) => i.section))];
  const standby = (await standbyActivity(ctx.db, ctx.edition.id, ctx.now)).filter(
    (r) => r.slotId === slot.id && (r.status === "waiting" || r.status === "offered"),
  );
  const myStandby = standby.find((r) => r.personId === ctx.actor.personId);
  const waiting = standby.filter((r) => r.status === "waiting");
  const started = slot.startsAt <= ctx.now;
  const state = started
    ? "none"
    : onIt
      ? "on_shift"
      : myStandby?.status === "offered"
        ? "offered"
        : myStandby
          ? "waiting"
          : crew.length >= slot.maxStaff && ctx.actor.personId
            ? "full"
            : "none";
  const offerText =
    myStandby?.status === "offered"
      ? `${myStandby.droppedByName ?? "Someone"} can no longer do ${slot.dutyName} on ${formatCampDay(slot.startsAt, "EEEE")} from ${time(slot.startsAt)} to ${time(slot.endsAt)}. You're first on standby, so it's yours if you want it.`
      : undefined;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href="/shifts" className="text-sm underline">
        ← Shifts
      </Link>
      <header className="rounded-2xl border bg-card p-4">
        <h1 className="heading text-lg">{slot.dutyName}</h1>
        <p className="text-sm">
          {formatCampDay(slot.startsAt, "EEEE d MMM")}, {time(slot.startsAt)}–{time(slot.endsAt)}
        </p>
        {duty?.description ? <p className="mt-2 text-sm">{duty.description}</p> : null}
        <p className="mt-2 text-sm">
          Lead: {duty?.leadName ?? "to be confirmed"}
          {slot.skillLabel ? ` · Needs ${slot.skillLabel}` : ""}
          {duty?.needsHandover ? " · Hand over to the next team before you leave" : ""}
        </p>
      </header>
      <section aria-labelledby="crew" className="rounded-2xl border bg-card p-4">
        <h2 id="crew" className="heading text-sm">
          On this shift ({crew.length} of {slot.maxStaff})
        </h2>
        <ul className="mt-1 text-sm">
          {crew.map((c) => (
            <li key={c.personId}>{c.name}</li>
          ))}
        </ul>
        {waiting.length ? (
          <p className="mt-2 text-sm">On standby: {waiting.map((w) => w.name).join(", ")}</p>
        ) : null}
        <div className="mt-3">
          <StandbyControls
            slotId={slot.id}
            state={state}
            offerText={offerText}
            place={myStandby ? waiting.findIndex((w) => w.id === myStandby.id) + 1 : undefined}
          />
        </div>
      </section>
      {checklist.length ? (
        <section aria-labelledby="list" className="rounded-2xl border bg-card p-4">
          <h2 id="list" className="heading text-sm">
            Checklist
          </h2>
          {sections.map((sec) => (
            <fieldset key={sec} className="mt-3">
              <legend className="text-sm font-semibold">{SECTION[sec] ?? sec}</legend>
              {checklist
                .filter((i) => i.section === sec)
                .map((i) => (
                  <TickBox
                    key={i.id}
                    slotId={slot.id}
                    itemId={i.id}
                    text={i.text}
                    ticked={i.ticked}
                    canTick={onIt}
                  />
                ))}
            </fieldset>
          ))}
        </section>
      ) : null}
    </div>
  );
}
