import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { formatCampTime, instantToCampInput } from "@/lib/dates";
import { isLoadOpen, nextLoadMoves, qtyText } from "../../rules/loads";
import { getLoad, itemsOf, listPlaces, listVehicles } from "../../server/queries";
import { CriticalTag, dayText, departsText, LoadChip } from "../components/bits";
import {
  ConfirmDeliveryButton,
  EditLoadForm,
  MoveButtons,
  PackToggle,
  TakeOffButton,
} from "../components/load-actions";
import { AddItemForm } from "../components/load-forms";

/** One load: what's on it (critical first), where it's going, and moving it along. */
export async function LoadPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  const a = ctx.actor;
  const manage = can(a, "logistics.loads.manage");
  const confirm = can(a, "logistics.delivery.confirm");
  if (!manage && !confirm && !can(a, "logistics.export")) notFound();
  const load = await getLoad(ctx.db, ctx.edition.id, id);
  if (!load) notFound();
  const [items, places, vehicles] = await Promise.all([
    itemsOf(ctx.db, id),
    manage ? listPlaces(ctx.db) : Promise.resolve([]),
    manage ? listVehicles(ctx.db, ctx.edition.id) : Promise.resolve([]),
  ]);
  const open = isLoadOpen(load.status);
  const dep = load.departsAt ? instantToCampInput(load.departsAt) : { date: "", time: "" };
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">
        <Link href="/logistics" className="underline">
          ← Travel and loads
        </Link>
      </p>
      <header className="flex flex-col gap-1 rounded-2xl bg-sunset p-4 text-white lg:bg-none lg:p-0 lg:text-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="heading text-lg">{load.name}</h1>
          <LoadChip status={load.status} />
        </div>
        <p className="text-sm opacity-90">
          {load.originName ?? "?"} → {load.destinationName ?? "no destination yet"} ·{" "}
          {departsText(load.departsAt)} · {load.vehicleLabel ?? "no vehicle yet"}
        </p>
        {load.deliveredConfirmedAt ? (
          <p className="text-sm font-semibold">
            Arrived: confirmed by {load.deliveredByName ?? "someone"},{" "}
            {formatCampTime(load.deliveredConfirmedAt, "EEE d MMM, HH:mm")}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section aria-labelledby="items-h" className="flex flex-col gap-2">
          <h2 id="items-h" className="heading text-sm">
            On this load ({load.packedCount}/{load.itemCount} packed)
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on it yet.</p>
          ) : null}
          <ul className="flex flex-col divide-y rounded-2xl border bg-card px-3 text-sm">
            {items.map((i) => {
              const label = `${i.description} ${qtyText(i.quantity, i.unit)}`;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  {manage && open ? (
                    <PackToggle itemId={i.id} packed={i.packedAt !== null} label={label} />
                  ) : (
                    <span className="flex min-h-11 items-center">
                      {i.packedAt ? "✓ " : ""}
                      {label}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    {i.isCritical ? <CriticalTag /> : null}
                    {i.neededBy ? (
                      <span className="text-xs text-muted-foreground">
                        by {dayText(i.neededBy)}
                      </span>
                    ) : null}
                    {manage && open ? <TakeOffButton itemId={i.id} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {manage && open ? (
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Add something</h3>
              <AddItemForm loadId={load.id} />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="move-h" className="flex flex-col gap-3">
          <h2 id="move-h" className="heading text-sm">
            {open ? "Move it along" : "Finished"}
          </h2>
          {confirm && load.status === "in_transit" ? (
            <ConfirmDeliveryButton loadId={load.id} />
          ) : null}
          {!manage && confirm && open && load.status !== "in_transit" ? (
            <p className="text-sm text-muted-foreground">
              Once it's on the road you can confirm it arrived here.
            </p>
          ) : null}
          {manage ? <MoveButtons loadId={load.id} moves={nextLoadMoves(load.status)} /> : null}
          {manage && open ? (
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Where, when and how</h3>
              <EditLoadForm
                load={{
                  id: load.id,
                  version: load.version,
                  vehicleId: load.vehicleId,
                  originPlaceId: load.originPlaceId,
                  destinationPlaceId: load.destinationPlaceId,
                  departsDate: dep.date,
                  departsTime: dep.time,
                }}
                places={places.map((p) => ({ id: p.id, name: p.name }))}
                vehicles={vehicles.map((v) => ({ id: v.id, name: v.label }))}
              />
            </div>
          ) : null}
          {!manage && !confirm ? (
            <p className="text-sm text-muted-foreground">
              The Logistics team and camp leads move loads; any team lead confirms a delivery once
              it's on the road.
            </p>
          ) : null}
          {load.notes ? <p className="text-sm">{load.notes}</p> : null}
        </section>
      </div>
    </div>
  );
}
