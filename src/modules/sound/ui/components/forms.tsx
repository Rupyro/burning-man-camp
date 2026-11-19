"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { logVisit, savePlan } from "../../server/actions";
import type { SoundPlan } from "../../server/queries";

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

export function PlanForm({ initial }: { initial: SoundPlan }) {
  const [v, setV] = useState(initial);
  const { msg, pending, run } = useSave();
  return (
    <form
      className="mt-3 grid grid-cols-3 items-end gap-2"
      aria-label="Change the plan"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => savePlan(v));
      }}
    >
      <Field
        label="Quiet from"
        type="time"
        value={v.quietFrom}
        onChange={(e) => setV({ ...v, quietFrom: e.target.value })}
      />
      <Field
        label="Quiet until"
        type="time"
        value={v.quietUntil}
        onChange={(e) => setV({ ...v, quietUntil: e.target.value })}
      />
      <Field
        label="Max dB"
        type="number"
        min={40}
        max={140}
        value={v.maxDb}
        onChange={(e) => setV({ ...v, maxDb: Number(e.target.value) || 0 })}
      />
      <div className="col-span-3">
        <Field
          label="Speakers face"
          maxLength={120}
          value={v.speakersFace ?? ""}
          onChange={(e) => setV({ ...v, speakersFace: e.target.value })}
        />
      </div>
      <Button type="submit" disabled={pending} className="col-span-3">
        {pending ? "Saving…" : "Save the plan"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-3 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

const EMPTY = { date: "", time: "", neighbor: "", what: "", action: "" };

export function LogForm() {
  const [v, setV] = useState(EMPTY);
  const { msg, pending, run } = useSave();
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="grid grid-cols-2 items-end gap-2"
      aria-label="Log a visit"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => logVisit({ ...v, action: v.action || null }),
          () => setV(EMPTY),
        );
      }}
    >
      <Field label="Date" type="date" required value={v.date} onChange={set("date")} />
      <Field label="Time" type="time" required value={v.time} onChange={set("time")} />
      <div className="col-span-2">
        <Field
          label="Neighbor (camp or person)"
          required
          maxLength={80}
          value={v.neighbor}
          onChange={set("neighbor")}
        />
      </div>
      <div className="col-span-2">
        <Field
          label="What they said"
          required
          maxLength={500}
          value={v.what}
          onChange={set("what")}
        />
      </div>
      <div className="col-span-2">
        <Field
          label="What we did (optional)"
          maxLength={500}
          value={v.action}
          onChange={set("action")}
        />
      </div>
      <Button type="submit" disabled={pending} className="col-span-2">
        {pending ? "Saving…" : "Log the visit"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-2 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
