"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markSubmitted, reopenObligation, updateObligation } from "../../server/actions";

function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        setMsg(done);
        router.refresh();
      } catch {
        setMsg("That didn't work. You may not be allowed to do this.");
      }
    });
  };
  return { msg, pending, run };
}

function Status({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
}

function Shell(props: { onSubmit: (f: FormData) => void; children: ReactNode }) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(new FormData(e.currentTarget));
      }}
    >
      {props.children}
    </form>
  );
}

export function SubmitForm({ taskId }: { taskId: string }) {
  const { msg, pending, run } = useAction();
  return (
    <Shell
      onSubmit={(f) =>
        run(
          () =>
            markSubmitted({ taskId, confirmationRef: String(f.get("ref") ?? "").trim() || null }),
          "Marked as submitted.",
        )
      }
    >
      <Label htmlFor="ref">Confirmation or reference (optional)</Label>
      <Input
        id="ref"
        name="ref"
        maxLength={80}
        className="min-h-11"
        placeholder="e.g. AB-2027-114"
      />
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? "Saving…" : "Mark submitted"}
      </Button>
      <Status msg={msg} />
    </Shell>
  );
}

export function ReopenButton({ taskId }: { taskId: string }) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        disabled={pending}
        className="min-h-11 self-start"
        onClick={() => run(() => reopenObligation({ taskId }), "Reopened.")}
      >
        Reopen
      </Button>
      <Status msg={msg} />
    </div>
  );
}

export function EditForm(props: {
  taskId: string;
  dueDate: string;
  dateConfirmed: boolean;
  ownerPersonId: string | null;
  sourceUrl: string;
  notes: string;
  documents: string;
  people: { id: string; name: string }[];
}) {
  const { msg, pending, run } = useAction();
  return (
    <Shell
      onSubmit={(f) => {
        const s = (k: string) => String(f.get(k) ?? "").trim();
        run(
          () =>
            updateObligation({
              taskId: props.taskId,
              dueDate: s("due") || null,
              dateConfirmed: f.get("confirmed") === "on",
              ownerPersonId: s("owner") || null,
              sourceUrl: s("source") || null,
              notes: s("notes") || null,
              requiredDocuments: s("docs")
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean),
            }),
          "Saved.",
        );
      }}
    >
      <Label htmlFor="owner">Owner</Label>
      <select
        id="owner"
        name="owner"
        defaultValue={props.ownerPersonId ?? ""}
        className="min-h-11 rounded-md border bg-card px-2"
      >
        <option value="">No owner</option>
        {props.people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Label htmlFor="due">Due date (camp time)</Label>
      <Input id="due" name="due" type="date" defaultValue={props.dueDate} className="min-h-11" />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirmed" defaultChecked={props.dateConfirmed} />
        Date confirmed by AfrikaBurn
      </label>
      <Label htmlFor="source">Source link</Label>
      <Input
        id="source"
        name="source"
        type="url"
        defaultValue={props.sourceUrl}
        className="min-h-11"
      />
      <Label htmlFor="docs">Required documents (one per line)</Label>
      <textarea
        id="docs"
        name="docs"
        rows={3}
        defaultValue={props.documents}
        className="rounded-md border bg-card p-2"
      />
      <Label htmlFor="notes">Notes</Label>
      <textarea
        id="notes"
        name="notes"
        rows={3}
        maxLength={2000}
        defaultValue={props.notes}
        className="rounded-md border bg-card p-2"
      />
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
      <Status msg={msg} />
    </Shell>
  );
}
