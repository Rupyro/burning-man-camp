import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { arrivalsByDay } from "../../rules/exports";
import { GAP_TEXT, isLoadOpen, qtyText } from "../../rules/loads";
import { DIRECTION_LABEL, type Direction, MODE_LABEL } from "../../rules/rides";
import { membersFor } from "../../server/members";
import { criticalGaps, listLoads, listPlaces, listVehicles } from "../../server/queries";
import { rideCounts, travelFor } from "../../server/rides";
import { CriticalTag, dayText, departsText, LoadChip, TIME_LABEL } from "../components/bits";
import { ExportButtons } from "../components/export-buttons";
import { AssignGapForm, NewLoadForm } from "../components/load-forms";
import { AskButton, RideActions, TravelForm } from "../components/travel-forms";

const DIRECTIONS: Direction[] = ["to_burn", "from_burn"];
const AREA_KINDS = new Set(["city_area", "airport", "pickup"]);

/**
 * Members (phone-first): your travel both ways, your rides and offers that fit.
 * Leads (laptop-first): counters, critical gaps, loads and a new-load form; travel sits alongside.
 */
export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const a = ctx.actor;
  const me = a.personId;
  const manage = can(a, "logistics.loads.manage");
  const lead = manage || can(a, "logistics.delivery.confirm") || can(a, "logistics.export");
  const exporter = can(a, "logistics.export");
  const [places, travel, loads, gaps, vehicles, counts, members] = await Promise.all([
    listPlaces(ctx.db),
    me ? travelFor(ctx.db, ctx.edition.id, me) : Promise.resolve(null),
    lead ? listLoads(ctx.db, ctx.edition.id) : Promise.resolve([]),
    lead ? criticalGaps(ctx.db, ctx.edition.id) : Promise.resolve([]),
    manage ? listVehicles(ctx.db, ctx.edition.id) : Promise.resolve([]),
    lead ? rideCounts(ctx.db, ctx.edition.id) : Promise.resolve(null),
    exporter ? membersFor(ctx.db, ctx.edition.id) : Promise.resolve([]),
  ]);
  const arrivals = arrivalsByDay(members);
  const areas = places.filter((p) => AREA_KINDS.has(p.kind));
  const open = loads.filter((l) => isLoadOpen(l.status));
  const openOpts = open.map((l) => ({ id: l.id, name: l.name }));
  const travelEdit = can(a, "logistics.travel.edit");

  const travelBlock = travel ? (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="rides-h" id="rides" className="flex flex-col gap-2">
        <h2 id="rides-h" className="heading text-sm">
          Your rides ({travel.rides.length})
        </h2>
        {travel.rides.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rides yet. Say how you're travelling below and we'll show rides that fit.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {travel.rides.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
              <p className="font-medium">
                {r.driving ? `${r.otherName} wants a lift` : `Lift with ${r.otherName}`}
                {r.seats > 1 ? ` (${r.seats} seats)` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {DIRECTION_LABEL[r.direction]} · {dayText(r.travelDate)}
                {r.areaName ? ` · ${r.areaName}` : ""} ·{" "}
                <span className="font-semibold text-foreground">
                  {r.status === "accepted"
                    ? "Agreed"
                    : r.driving
                      ? "Waiting for your answer"
                      : "Asked, waiting"}
                </span>
              </p>
              {r.status === "accepted" ? (
                <p className="mt-1">
                  {r.otherPhone ? (
                    <a href={`tel:${r.otherPhone}`} className="underline">
                      {r.otherPhone}
                    </a>
                  ) : (
                    "No phone on their profile"
                  )}
                  {" · "}
                  <a href={`mailto:${r.otherEmail}`} className="underline">
                    {r.otherEmail}
                  </a>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Phone numbers show once the driver says yes.
                </p>
              )}
              <div className="mt-2">
                <RideActions matchId={r.id} canAnswer={r.driving && r.status === "proposed"} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {travel.offers.map(({ need, offers, hasRide }) =>
        hasRide ? null : (
          <section
            key={need.id}
            aria-label={`Rides that fit: ${DIRECTION_LABEL[need.direction]}`}
            className="flex flex-col gap-2"
          >
            <h2 className="heading text-sm">
              Rides that fit: {DIRECTION_LABEL[need.direction].toLowerCase()} ({offers.length})
            </h2>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody's offering a ride within a day of {dayText(need.travelDate)} yet. We'll keep
                looking.
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {offers.map((o) => (
                <li key={o.plan.id} className="rounded-2xl border bg-card p-3 text-sm">
                  <p className="font-medium">{o.plan.personName}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayText(o.plan.travelDate)}, {TIME_LABEL[o.plan.timeOfDay]} · from{" "}
                    {o.plan.areaName ?? "anywhere"} · {o.seatsLeft} seat
                    {o.seatsLeft === 1 ? "" : "s"} free
                    {o.plan.carriesCargo ? " · can take kit" : ""}
                  </p>
                  <div className="mt-2">
                    {o.asked ? (
                      <p className="text-xs font-semibold">
                        You've asked. Waiting for {o.plan.personName}.
                      </p>
                    ) : (
                      <AskButton passengerPlanId={need.id} driverPlanId={o.plan.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      <section aria-labelledby="travel" className="flex flex-col gap-2">
        <h2 id="travel" className="heading text-sm">
          Your travel
        </h2>
        <p className="text-xs text-muted-foreground">
          Only people you agree a ride with see your phone number. Flights and ID details aren't
          collected here.
        </p>
        <ul className="flex flex-col gap-2">
          {DIRECTIONS.map((d) => {
            const p = travel.mine.find((x) => x.direction === d) ?? null;
            return (
              <li key={d} className="rounded-2xl border bg-card p-3 text-sm">
                <details open={!p && !lead}>
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{DIRECTION_LABEL[d]}:</span>{" "}
                      {p
                        ? `${MODE_LABEL[p.mode]}, ${dayText(p.travelDate)}${
                            p.mode === "offering_ride" ? `, ${p.seatsOffered} seats` : ""
                          }`
                        : "not set yet"}
                    </span>
                    <span className="text-xs underline">{p ? "Change" : "Add"}</span>
                  </summary>
                  {travelEdit ? (
                    <div className="mt-2">
                      <TravelForm
                        direction={d}
                        areas={areas.map((x) => ({ id: x.id, name: x.name }))}
                        plan={
                          p
                            ? {
                                mode: p.mode,
                                travelDate: p.travelDate,
                                timeOfDay: p.timeOfDay,
                                areaPlaceId: p.areaPlaceId,
                                areaDetail: p.areaDetail,
                                seats: p.mode === "offering_ride" ? p.seatsOffered : p.seatsNeeded,
                                carriesCargo: p.carriesCargo,
                                notes: p.notes,
                              }
                            : null
                        }
                      />
                    </div>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  ) : null;

  const counters = [
    ["Open loads", open.length],
    ["Critical gaps", gaps.length],
    ["Still need a ride", counts?.needRide ?? 0],
    ["Travel plans in", counts?.planned ?? 0],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-sunset p-4 text-white lg:bg-none lg:p-0 lg:text-foreground">
        <h1 className="heading text-lg">Travel and loads</h1>
        <p className="text-sm opacity-90">
          {lead
            ? `Getting people and kit to site and back for ${ctx.edition.year}.`
            : "How you're getting there and back, and rides with other members."}
        </p>
      </header>

      {lead ? (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Logistics totals">
              {counters.map(([label, n]) => (
                <div key={label} className="rounded-2xl border bg-card p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-wordmark text-2xl">{n}</dd>
                </div>
              ))}
            </dl>

            <section aria-labelledby="gaps-h" id="gaps" className="flex flex-col gap-2">
              <h2 id="gaps-h" className="heading text-sm">
                Critical, not on its way ({gaps.length})
              </h2>
              {gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every critical item is on a load with somewhere to go.
                </p>
              ) : null}
              <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
                {gaps.map((g) => (
                  <li key={g.id} className="rounded-2xl border border-rust bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {g.description} {qtyText(g.quantity, g.unit)}
                      </p>
                      <CriticalTag />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{GAP_TEXT[g.reason]}</span>
                      {g.loadName ? ` (${g.loadName})` : ""} · needed{" "}
                      {g.neededBy ? `by ${dayText(g.neededBy)}` : "on site"}
                      {g.sourceRefType === "procurement.need" ? " · from a kit need" : ""}
                    </p>
                    {manage ? (
                      <div className="mt-2">
                        <AssignGapForm itemId={g.id} loads={openOpts} current={g.loadId} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="loads-h" className="flex flex-col gap-2">
              <h2 id="loads-h" className="heading text-sm">
                Loads ({loads.length})
              </h2>
              {loads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No loads planned yet.</p>
              ) : null}
              <ul className="flex flex-col gap-2 lg:hidden">
                {loads.map((l) => (
                  <li key={l.id} className="rounded-2xl border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/logistics/l/${l.id}`}
                        className="font-medium underline [overflow-wrap:anywhere]"
                      >
                        {l.name}
                      </Link>
                      <LoadChip status={l.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {departsText(l.departsAt)} · {l.originName ?? "?"} →{" "}
                      {l.destinationName ?? "no destination"}
                    </p>
                    <p className="text-xs">
                      {l.packedCount}/{l.itemCount} packed
                      {l.criticalCount ? ` · ${l.criticalCount} critical` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full border-collapse overflow-hidden rounded-2xl bg-card text-sm lg:table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    {["Load", "Status", "Leaves", "From → to", "Vehicle", "Packed"].map((h) => (
                      <th key={h} className="border-b p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="p-2">
                        <Link
                          href={`/logistics/l/${l.id}`}
                          className="font-medium underline [overflow-wrap:anywhere]"
                        >
                          {l.name}
                        </Link>
                      </td>
                      <td className="p-2">
                        <LoadChip status={l.status} />
                      </td>
                      <td className="p-2 text-xs">{departsText(l.departsAt)}</td>
                      <td className="p-2 text-xs">
                        {l.originName ?? "?"} →{" "}
                        {l.destinationName ?? <span className="font-semibold">no destination</span>}
                      </td>
                      <td className="p-2 text-xs">{l.vehicleLabel ?? "none yet"}</td>
                      <td className="p-2 text-xs">
                        {l.packedCount}/{l.itemCount}
                        {l.criticalCount ? ` · ${l.criticalCount} critical` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {exporter ? (
              <section aria-labelledby="arrivals-h" className="flex flex-col gap-2">
                <h2 id="arrivals-h" className="heading text-sm">
                  Arrivals by day
                </h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-6">
                  {arrivals.map((g) => (
                    <li key={g.day ?? "unknown"} className="rounded-2xl border bg-card p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {g.day ? dayText(g.day) : "Not known yet"}
                      </p>
                      <p className="font-wordmark text-xl">{g.names.length}</p>
                    </li>
                  ))}
                </ul>
                <ExportButtons />
              </section>
            ) : null}

            {manage ? (
              <section className="rounded-2xl border bg-card p-4">
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                    Plan a new load
                  </summary>
                  <div className="mt-2">
                    <NewLoadForm
                      places={places.map((p) => ({ id: p.id, name: p.name }))}
                      vehicles={vehicles.map((v) => ({ id: v.id, name: v.label }))}
                    />
                  </div>
                </details>
              </section>
            ) : null}
          </div>
          <aside aria-label="Your travel and rides">{travelBlock}</aside>
        </div>
      ) : (
        travelBlock
      )}
    </div>
  );
}
