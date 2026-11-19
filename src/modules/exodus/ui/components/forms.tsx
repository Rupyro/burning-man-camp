"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { clearMyDeparture, setMyDeparture } from "../../server/actions";

const input = "min-h-11 rounded-lg border bg-background px-2";

function useSave() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (isActionFailure(res)) setMsg(res.error);
        else {
          setMsg("Saved.");
          after?.();
          router.refresh();
        }
      } catch {
        setMsg("That didn't save. Please try again.");
      }
    });
  return { msg, pending, run };
}

function Field(p: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { label, ...rest } = p;
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input className={input} {...rest} />
    </label>
  );
}

type Value = { date: string; time: string; staysForSweep: boolean; travel: string };

export function DepartureForm({ initial }: { initial: Value | null }) {
  const [v, setV] = useState<Value>(
    initial ?? { date: "", time: "", staysForSweep: false, travel: "" },
  );
  const { msg, pending, run } = useSave();
  return (
    <form
      className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      aria-label="When I leave"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setMyDeparture(v));
      }}
    >
      <h2 className="col-span-2 font-semibold">When I leave</h2>
      <Field
        label="Day"
        type="date"
        required
        value={v.date}
        onChange={(e) => setV({ ...v, date: e.target.value })}
      />
      <Field
        label="Time"
        type="time"
        required
        value={v.time}
        onChange={(e) => setV({ ...v, time: e.target.value })}
      />
      <div className="col-span-2">
        <Field
          label="How (own car, ride, bus)"
          maxLength={200}
          value={v.travel}
          onChange={(e) => setV({ ...v, travel: e.target.value })}
        />
      </div>
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.staysForSweep}
          onChange={(e) => setV({ ...v, staysForSweep: e.target.checked })}
        />
        I'll stay for the final sweep
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Saving…" : "Save"}
      </Button>
      {initial ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={pending}
          onClick={() => run(() => clearMyDeparture({}))}
        >
          Clear
        </Button>
      ) : null}
      {msg ? (
        <p role="status" className="col-span-2 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
