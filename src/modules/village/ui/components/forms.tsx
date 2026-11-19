"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { type Direction, RESOURCE_LABEL, RESOURCES, type Resource } from "../../rules/village";
import { addShare, setReturned } from "../../server/actions";

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
  partner: "",
  direction: "borrow" as Direction,
  resource: "other" as Resource,
  item: "",
  quantity: 1,
  notes: "",
};

export function AddShareForm() {
  const [v, setV] = useState(EMPTY);
  const { msg, pending, run } = useSave();
  return (
    <form
      className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      aria-label="Record a share"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addShare(v),
          () => setV({ ...EMPTY, partner: v.partner }),
        );
      }}
    >
      <Field
        label="Partner camp"
        required
        maxLength={80}
        value={v.partner}
        onChange={(e) => setV({ ...v, partner: e.target.value })}
      />
      <label className="flex flex-col gap-1 text-sm">
        We
        <select
          className={input}
          value={v.direction}
          onChange={(e) => setV({ ...v, direction: e.target.value as Direction })}
        >
          <option value="borrow">borrow it from them</option>
          <option value="lend">lend it to them</option>
        </select>
      </label>
      <div className="col-span-2">
        <Field
          label="What"
          required
          maxLength={120}
          value={v.item}
          onChange={(e) => setV({ ...v, item: e.target.value })}
        />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Kind
        <select
          className={input}
          value={v.resource}
          onChange={(e) => setV({ ...v, resource: e.target.value as Resource })}
        >
          {RESOURCES.map((r) => (
            <option key={r} value={r}>
              {RESOURCE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="How many"
        type="number"
        min={1}
        value={v.quantity}
        onChange={(e) => setV({ ...v, quantity: Number(e.target.value) || 0 })}
      />
      <div className="col-span-2">
        <Field
          label="Notes"
          maxLength={300}
          value={v.notes}
          onChange={(e) => setV({ ...v, notes: e.target.value })}
        />
      </div>
      <Button type="submit" disabled={pending} className="col-span-2 min-h-11">
        {pending ? "Saving…" : "Record it"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-2 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

export function ReturnedButton({ id, returned }: { id: string; returned: boolean }) {
  const { pending, run } = useSave();
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11"
      disabled={pending}
      onClick={() => run(() => setReturned({ id, returned: !returned }))}
    >
      {returned ? "Not back yet" : "Mark returned"}
    </Button>
  );
}
