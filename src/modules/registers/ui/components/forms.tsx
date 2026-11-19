"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, KINDS, type RegisterKind } from "../../rules/registers";
import { addItem, removeItem, setPulled } from "../../server/actions";

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

const EMPTY = { kind: "fuel" as RegisterKind, label: "", quantity: 1, location: "", notes: "" };

export function AddItemForm({ unit }: { unit: string }) {
  const [v, setV] = useState(EMPTY);
  const { msg, pending, run } = useSave();
  const qtyLabel =
    v.kind === "fuel" ? `Amount (${unit})` : v.kind === "stake" ? "How many went in" : "How many";
  return (
    <form
      className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      aria-label="Add to a register"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addItem({ ...v, ownerPersonId: null }),
          () => setV({ ...EMPTY, kind: v.kind }),
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Register
        <select
          className={input}
          value={v.kind}
          onChange={(e) => setV({ ...v, kind: e.target.value as RegisterKind })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={qtyLabel}
        type="number"
        min={1}
        required
        value={v.quantity}
        onChange={(e) => setV({ ...v, quantity: Number(e.target.value) || 0 })}
      />
      <div className="col-span-2">
        <Field
          label="What it is"
          required
          maxLength={120}
          value={v.label}
          onChange={(e) => setV({ ...v, label: e.target.value })}
        />
      </div>
      <Field
        label="Where"
        maxLength={120}
        value={v.location}
        onChange={(e) => setV({ ...v, location: e.target.value })}
      />
      <Field
        label="Notes"
        maxLength={500}
        value={v.notes}
        onChange={(e) => setV({ ...v, notes: e.target.value })}
      />
      <Button type="submit" disabled={pending} className="col-span-2">
        {pending ? "Saving…" : "Add"}
      </Button>
      {msg ? (
        <p role="status" className="col-span-2 text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

export function PulledForm({
  id,
  quantity,
  pulled,
}: {
  id: string;
  quantity: number;
  pulled: number;
}) {
  const [v, setV] = useState(pulled);
  const { msg, pending, run } = useSave();
  return (
    <form
      className="mt-1 flex items-end gap-2"
      aria-label="Stakes pulled"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setPulled({ id, pulled: v }));
      }}
    >
      <Field
        label="Pulled"
        type="number"
        min={0}
        max={quantity}
        value={v}
        onChange={(e) => setV(Number(e.target.value) || 0)}
      />
      <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>
        Save
      </Button>
      {msg ? (
        <span role="status" className="text-xs">
          {msg}
        </span>
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
        if (window.confirm("Remove this line?")) run(() => removeItem({ id }));
      }}
    >
      Remove
    </Button>
  );
}
