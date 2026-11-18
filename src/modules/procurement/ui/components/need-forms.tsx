"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type NeedStatus, STATUS_LABEL } from "../../rules/status";
import { askFinance, editNeed, moveNeed, raiseNeed, setCritical } from "../../server/needs";
import { setCount } from "../../server/stock";
import { area, Form, field, Status, s, select, useAction } from "./forms";

const CONDITION_LABEL = {
  good: "Good",
  needs_repair: "Needs repair",
  broken: "Broken",
  missing: "Missing",
} as const;

/** On site: set how many of this item are at a place, in a condition (P2). */
export function CountForm(props: {
  itemId: string;
  unit: string;
  places: { id: string; name: string }[];
  /** The place to start on (where the item already is). */
  placeId?: string;
}) {
  const { msg, pending, run } = useAction();
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            setCount({
              itemId: props.itemId,
              locationId: s(f, "place"),
              condition: s(f, "condition") as keyof typeof CONDITION_LABEL,
              quantity: s(f, "qty"),
              note: s(f, "note") || undefined,
            }),
          "Count saved.",
        )
      }
    >
      <Label htmlFor="place">Where</Label>
      <select id="place" name="place" className={select} defaultValue={props.placeId}>
        {props.places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Label htmlFor="condition">Condition</Label>
      <select id="condition" name="condition" className={select}>
        {Object.entries(CONDITION_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Label htmlFor="qty">How many are there now? ({props.unit})</Label>
      <Input id="qty" name="qty" inputMode="decimal" required className={field} placeholder="2" />
      <Label htmlFor="note">Note (optional)</Label>
      <Input
        id="note"
        name="note"
        maxLength={200}
        className={field}
        placeholder="Found one in the shower block"
      />
      <Button type="submit" disabled={pending} className="min-h-11">
        Save count
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

/** Raise a need for one of your teams. */
export function RaiseNeedForm(props: {
  teams: { id: string; name: string }[];
  items: { id: string; name: string; unit: string }[];
  itemId?: string;
}) {
  const { msg, pending, run, router } = useAction();
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            raiseNeed({
              teamId: s(f, "team"),
              itemId: s(f, "item"),
              quantity: s(f, "qty"),
              neededBy: s(f, "needed") || undefined,
              notes: s(f, "notes") || undefined,
            }),
          "Need raised.",
          (r) => router.push(`/procurement/n/${(r as { id: string }).id}`),
        )
      }
    >
      <Label htmlFor="team">For which team?</Label>
      <select id="team" name="team" className={select}>
        {props.teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Label htmlFor="item">What do you need?</Label>
      <select id="item" name="item" className={select} defaultValue={props.itemId}>
        {props.items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.unit})
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Not in the list? Ask a team lead to add it to the kit first.
      </p>
      <Label htmlFor="qty">How many?</Label>
      <Input id="qty" name="qty" inputMode="decimal" required className={field} placeholder="4" />
      <Label htmlFor="needed">Needed by (optional)</Label>
      <Input id="needed" name="needed" type="date" className={field} />
      <Label htmlFor="notes">What it's for (optional)</Label>
      <textarea id="notes" name="notes" rows={2} maxLength={1000} className={area} />
      <Button type="submit" disabled={pending} className="min-h-11">
        Raise need
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

/** Lead tools on a need: move it, flag critical, ask finance for the gap. */
export function NeedLeadActions(props: {
  id: string;
  moves: NeedStatus[];
  critical: boolean;
  canAskFinance: boolean;
  gap: number;
  estimate: string;
}) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-3">
      {props.canAskFinance ? (
        <Form
          onSubmit={(f) =>
            run(
              () => askFinance({ id: props.id, estimate: s(f, "estimate") || undefined }),
              "Sent to finance. If your team has a budget, a draft spend request is waiting in Money for you to check and send.",
            )
          }
        >
          <Label htmlFor="estimate">Ask finance for the money to buy {props.gap}</Label>
          <Input
            id="estimate"
            name="estimate"
            inputMode="decimal"
            defaultValue={props.estimate}
            className={field}
            placeholder="About how much? (rand)"
            required
          />
          <Button type="submit" disabled={pending} className="min-h-11 self-start">
            Ask finance for the money
          </Button>
        </Form>
      ) : null}
      {props.moves.length ? (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm">Move this need to</legend>
          {props.moves.map((to) => (
            <Button
              key={to}
              type="button"
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={() =>
                run(() => moveNeed({ id: props.id, to }), `Moved to ${STATUS_LABEL[to]}.`)
              }
            >
              {STATUS_LABEL[to]}
            </Button>
          ))}
        </fieldset>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="min-h-11 self-start"
        onClick={() =>
          run(
            () => setCritical({ id: props.id, critical: !props.critical }),
            props.critical
              ? "No longer critical."
              : "Flagged critical. Logistics will plan a load for it.",
          )
        }
      >
        {props.critical ? "Not critical" : "Flag critical"}
      </Button>
      <Status msg={msg} />
    </div>
  );
}

/** Change quantity, date, supplier, estimate or notes. */
export function EditNeedForm(props: {
  id: string;
  lead: boolean;
  suppliers: { id: string; name: string }[];
  values: {
    quantity: string;
    neededBy: string;
    supplierId: string;
    estimate: string;
    notes: string;
  };
}) {
  const { msg, pending, run } = useAction();
  const v = props.values;
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            editNeed({
              id: props.id,
              quantity: s(f, "qty"),
              neededBy: s(f, "needed") || null,
              notes: s(f, "notes") || null,
              ...(props.lead
                ? { supplierId: s(f, "supplier") || null, estimate: s(f, "estimate") }
                : {}),
            }),
          "Saved.",
        )
      }
    >
      <Label htmlFor="e-qty">How many</Label>
      <Input
        id="e-qty"
        name="qty"
        inputMode="decimal"
        defaultValue={v.quantity}
        className={field}
      />
      <Label htmlFor="e-needed">Needed by</Label>
      <Input id="e-needed" name="needed" type="date" defaultValue={v.neededBy} className={field} />
      {props.lead ? (
        <>
          <Label htmlFor="e-supplier">Supplier</Label>
          <select id="e-supplier" name="supplier" defaultValue={v.supplierId} className={select}>
            <option value="">Not chosen</option>
            {props.suppliers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <Label htmlFor="e-estimate">Estimate (rand)</Label>
          <Input
            id="e-estimate"
            name="estimate"
            inputMode="decimal"
            defaultValue={v.estimate}
            className={field}
          />
        </>
      ) : null}
      <Label htmlFor="e-notes">Notes</Label>
      <textarea
        id="e-notes"
        name="notes"
        rows={2}
        maxLength={1000}
        defaultValue={v.notes}
        className={area}
      />
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 self-start">
        Save changes
      </Button>
      <Status msg={msg} />
    </Form>
  );
}
