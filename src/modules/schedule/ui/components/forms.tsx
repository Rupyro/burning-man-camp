"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "../../rules/schedule";
import { addEvent, removeEvent } from "../../server/actions";

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

const EMPTY = {
  title: "",
  description: "",
  category: "class" as Category,
  date: "",
  start: "",
  end: "",
  location: "",
};

export function AddEventForm({ firstDay }: { firstDay?: string }) {
  const [v, setV] = useState({ ...EMPTY, date: firstDay ?? "" });
  const { msg, pending, run } = useSave();
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="grid grid-cols-3 items-end gap-2 rounded-2xl border bg-card p-4"
      aria-label="Add an event"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addEvent({ ...v, hostPersonId: null }),
          () => setV({ ...EMPTY, date: v.date }),
        );
      }}
    >
      <div className="col-span-3">
        <Field label="What" required maxLength={120} value={v.title} onChange={set("title")} />
      </div>
      <Field label="Day" type="date" required value={v.date} onChange={set("date")} />
      <Field label="Starts" type="time" required value={v.start} onChange={set("start")} />
      <Field label="Ends" type="time" required value={v.end} onChange={set("end")} />
      <label className="flex flex-col gap-1 text-sm">
        Kind
        <select className={input} value={v.category} onChange={set("category")}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <div className="col-span-2">
        <Field label="Where" maxLength={120} value={v.location} onChange={set("location")} />
      </div>
      <div className="col-span-3">
        <Field
          label="Description for the guide"
          maxLength={1000}
          value={v.description}
          onChange={set("description")}
        />
      </div>
      <Button type="submit" disabled={pending} className="col-span-3 min-h-11">
        {pending ? "Saving…" : "Add the event"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-3 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveButton({ id }: { id: string }) {
  const { pending, run } = useSave();
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Remove this event?")) run(() => removeEvent({ id }));
      }}
    >
      Remove
    </Button>
  );
}
