"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import {
  type Allocations,
  EARLY_LABEL,
  EARLY_STATES,
  PASS_LABEL,
  PASS_STATES,
  TICKET_LABEL,
  TICKET_STATES,
  type TicketRow,
} from "../../rules/gate";
import { saveMyTickets, setAllocations } from "../../server/actions";

function useSave() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        const res = await fn();
        if (isActionFailure(res)) setMsg(res.error);
        else {
          setMsg("Saved.");
          router.refresh();
        }
      } catch {
        setMsg("That didn't save. Please try again.");
      }
    });
  return { msg, pending, run };
}

function Pick<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {props.label}
      <select
        className="min-h-11 rounded-lg border bg-background px-2"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {props.labels[o]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MyTicketsForm({
  initial,
  earlyPass,
}: {
  initial: TicketRow & { note: string | null };
  earlyPass: string;
}) {
  const [v, setV] = useState(initial);
  const { msg, pending, run } = useSave();
  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveMyTickets(v));
      }}
    >
      <Pick
        label="Ticket"
        value={v.ticket}
        options={TICKET_STATES}
        labels={TICKET_LABEL}
        onChange={(ticket) => setV({ ...v, ticket })}
      />
      <Pick
        label="Vehicle pass"
        value={v.vehiclePass}
        options={PASS_STATES}
        labels={PASS_LABEL}
        onChange={(vehiclePass) => setV({ ...v, vehiclePass })}
      />
      <Pick
        label={earlyPass}
        value={v.earlyArrival}
        options={EARLY_STATES}
        labels={EARLY_LABEL}
        onChange={(earlyArrival) => setV({ ...v, earlyArrival })}
      />
      <label className="flex flex-col gap-1 text-sm">
        Note for the leads (optional)
        <input
          className="min-h-11 rounded-lg border bg-background px-2"
          maxLength={200}
          value={v.note ?? ""}
          onChange={(e) => setV({ ...v, note: e.target.value })}
        />
      </label>
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function AllocationsForm({
  initial,
  earlyPass,
}: {
  initial: Allocations;
  earlyPass: string;
}) {
  const [v, setV] = useState(initial);
  const { msg, pending, run } = useSave();
  const field = (key: keyof Allocations, label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="number"
        min={0}
        max={500}
        className="min-h-11 rounded-lg border bg-background px-2"
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: Number(e.target.value) || 0 })}
      />
    </label>
  );
  return (
    <form
      className="grid grid-cols-3 items-end gap-2"
      aria-label="Allocations"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setAllocations(v));
      }}
    >
      {field("stewards", "Stewards tickets")}
      {field("vehiclePasses", "Vehicle passes")}
      {field("earlyPasses", `${earlyPass}es`)}
      <Button type="submit" disabled={pending} className="col-span-3">
        {pending ? "Saving…" : "Save allocations"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-3 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
