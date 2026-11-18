"use client";
import { Button } from "@/components/ui/button";
import { LOAD_STATUS_LABEL, type LoadStatus } from "../../rules/loads";
import { assignItem, confirmDelivery, moveLoad, packItem, updateLoad } from "../../server/loads";
import { Form, Status, s, useAction } from "./forms";
import { departsIso, Pick } from "./load-forms";

const VERB: Partial<Record<LoadStatus, string>> = {
  packing: "Start packing",
  in_transit: "It's left",
  planned: "Back to planned",
  cancelled: "Cancel this load",
};

export function MoveButtons({ loadId, moves }: { loadId: string; moves: readonly LoadStatus[] }) {
  const { msg, pending, run } = useAction();
  const list = moves.filter((m) => m !== "delivered");
  if (!list.length) return null;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">Move this load</legend>
      <div className="flex flex-wrap gap-2">
        {list.map((to) => (
          <Button
            key={to}
            type="button"
            variant={to === "cancelled" || to === "planned" ? "outline" : "default"}
            className="min-h-11"
            disabled={pending}
            onClick={() => run(() => moveLoad({ loadId, to }), `Now: ${LOAD_STATUS_LABEL[to]}.`)}
          >
            {VERB[to] ?? LOAD_STATUS_LABEL[to]}
          </Button>
        ))}
      </div>
      <Status msg={msg} />
    </fieldset>
  );
}

export function ConfirmDeliveryButton({ loadId }: { loadId: string }) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        className="min-h-11 self-start"
        disabled={pending}
        onClick={() => run(() => confirmDelivery({ loadId }), "Delivery confirmed. Thank you!")}
      >
        Confirm it arrived on site
      </Button>
      <Status msg={msg} />
    </div>
  );
}

export function PackToggle({
  itemId,
  packed,
  label,
}: {
  itemId: string;
  packed: boolean;
  label: string;
}) {
  const { msg, pending, run } = useAction();
  return (
    <span className="flex flex-col">
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={packed}
          disabled={pending}
          onChange={(e) => run(() => packItem({ itemId, packed: e.target.checked }), "Saved.")}
        />
        <span className={packed ? "line-through decoration-1" : ""}>{label}</span>
      </label>
      <Status msg={msg} />
    </span>
  );
}

export function TakeOffButton({ itemId }: { itemId: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11"
      disabled={pending}
      onClick={() => run(() => assignItem({ itemId, loadId: null }), "Taken off.")}
    >
      Take off
    </Button>
  );
}

type Opt = { id: string; name: string };
export function EditLoadForm(props: {
  load: {
    id: string;
    version: number;
    vehicleId: string | null;
    originPlaceId: string | null;
    destinationPlaceId: string | null;
    departsDate: string;
    departsTime: string;
  };
  places: Opt[];
  vehicles: Opt[];
}) {
  const { msg, pending, run } = useAction();
  const l = props.load;
  return (
    <Form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(f) =>
        run(
          () =>
            updateLoad({
              loadId: l.id,
              version: l.version,
              vehicleId: s(f, "vehicle") || null,
              originPlaceId: s(f, "from") || null,
              destinationPlaceId: s(f, "to") || null,
              departsAt: departsIso(s(f, "date"), s(f, "time")),
            }),
          "Saved.",
        )
      }
    >
      <Pick id="edit-from" name="from" label="From" opts={props.places} value={l.originPlaceId} />
      <Pick
        id="edit-to"
        name="to"
        label="To"
        opts={props.places}
        value={l.destinationPlaceId}
        none="No destination yet"
      />
      <Pick
        id="edit-vehicle"
        name="vehicle"
        label="Vehicle"
        opts={props.vehicles}
        value={l.vehicleId}
        none="None yet"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-date" className="text-sm font-medium">
            Leaves on
          </label>
          <input
            id="edit-date"
            name="date"
            type="date"
            defaultValue={l.departsDate}
            className="min-h-11 rounded-md border bg-card px-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-time" className="text-sm font-medium">
            At (camp time)
          </label>
          <input
            id="edit-time"
            name="time"
            type="time"
            defaultValue={l.departsTime}
            className="min-h-11 rounded-md border bg-card px-2"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        Save changes
      </Button>
      <Status msg={msg} />
    </Form>
  );
}
