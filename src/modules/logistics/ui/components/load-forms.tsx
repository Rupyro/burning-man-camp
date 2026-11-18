"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { campInputToInstant } from "@/lib/dates";
import { addItem, assignItem, createLoad } from "../../server/loads";
import { Form, field, Status, s, select, useAction } from "./forms";

type Opt = { id: string; name: string };

export function departsIso(date: string, time: string) {
  return date ? campInputToInstant(date, time || "08:00").toISOString() : null;
}

export function NewLoadForm({ places, vehicles }: { places: Opt[]; vehicles: Opt[] }) {
  const { msg, pending, run, router } = useAction();
  return (
    <Form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(f) =>
        run(
          () =>
            createLoad({
              name: s(f, "name"),
              direction: s(f, "direction") as "outbound" | "return" | "internal",
              originPlaceId: s(f, "from") || null,
              destinationPlaceId: s(f, "to") || null,
              vehicleId: s(f, "vehicle") || null,
              departsAt: departsIso(s(f, "date"), s(f, "time")),
            }),
          "Load added.",
          (r) => router.push(`/logistics/l/${(r as { id: string }).id}`),
        )
      }
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor="load-name">Name</Label>
        <input
          id="load-name"
          name="name"
          required
          maxLength={120}
          className={`${field} rounded-md border bg-card px-2`}
          placeholder="Truck 2: shade and build kit"
        />
      </div>
      <Pick
        id="load-dir"
        name="direction"
        label="Which way"
        opts={[
          { id: "outbound", name: "To site" },
          { id: "return", name: "Back from site" },
          { id: "internal", name: "In town" },
        ]}
        required
      />
      <Pick id="load-vehicle" name="vehicle" label="Vehicle" opts={vehicles} />
      <Pick id="load-from" name="from" label="From" opts={places} />
      <Pick id="load-to" name="to" label="To" opts={places} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="load-date">Leaves on</Label>
        <input
          id="load-date"
          name="date"
          type="date"
          className={`${field} rounded-md border bg-card px-2`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="load-time">At (camp time)</Label>
        <input
          id="load-time"
          name="time"
          type="time"
          className={`${field} rounded-md border bg-card px-2`}
        />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        Add load
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

export function Pick(props: {
  id: string;
  name: string;
  label: string;
  opts: Opt[];
  value?: string | null;
  required?: boolean;
  none?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select
        id={props.id}
        name={props.name}
        defaultValue={props.value ?? (props.required ? props.opts[0]?.id : "")}
        className={select}
      >
        {props.required ? null : <option value="">{props.none ?? "Not set"}</option>}
        {props.opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Put a critical gap on a load. */
export function AssignGapForm({
  itemId,
  loads,
  current,
}: {
  itemId: string;
  loads: Opt[];
  current: string | null;
}) {
  const { msg, pending, run } = useAction();
  if (!loads.length)
    return <p className="text-xs text-muted-foreground">No open loads yet. Add one below.</p>;
  return (
    <Form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(f) => run(() => assignItem({ itemId, loadId: s(f, "load") }), "On the load.")}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={`gap-${itemId}`} className="text-xs">
          Put it on
        </Label>
        <select
          id={`gap-${itemId}`}
          name="load"
          defaultValue={current ?? loads[0]?.id}
          className={select}
        >
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11">
        Put on load
      </Button>
      {current ? (
        <Link href={`/logistics/l/${current}`} className="text-xs underline">
          Open its load
        </Link>
      ) : null}
      <Status msg={msg} />
    </Form>
  );
}

/** Add something to a load (or, with no load, to the "needs a load" list). */
export function AddItemForm({ loadId }: { loadId: string | null }) {
  const { msg, pending, run } = useAction();
  return (
    <Form
      className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]"
      onSubmit={(f) =>
        run(
          () =>
            addItem({
              loadId,
              description: s(f, "description"),
              quantity: s(f, "quantity") || "1",
              unit: s(f, "unit") || "pcs",
              isCritical: f.get("critical") === "on",
              neededBy: s(f, "neededBy") || null,
            }),
          "Added.",
        )
      }
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="item-desc">What</Label>
        <input
          id="item-desc"
          name="description"
          required
          maxLength={200}
          className={`${field} rounded-md border bg-card px-2`}
          placeholder="Shade cloth 6x6"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="item-qty">How many</Label>
        <input
          id="item-qty"
          name="quantity"
          inputMode="decimal"
          defaultValue="1"
          className={`${field} rounded-md border bg-card px-2`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="item-unit">Unit</Label>
        <input
          id="item-unit"
          name="unit"
          defaultValue="pcs"
          maxLength={16}
          className={`${field} rounded-md border bg-card px-2`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="item-by">Needed by</Label>
        <input
          id="item-by"
          name="neededBy"
          type="date"
          className={`${field} rounded-md border bg-card px-2`}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="critical" /> Critical (camp can't run without it)
      </label>
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        Add
      </Button>
      <Status msg={msg} />
    </Form>
  );
}
