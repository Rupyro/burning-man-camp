"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideBatchRow } from "@/base/ingest/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveImportBatch, undoImportBatch } from "@/modules/procurement/server/import-actions";

type Decision = "accept" | "fix" | "skip";

export function RowDecision(props: {
  rowId: string;
  decision: string;
  responsible: string | null;
  setResponsible: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [fixing, setFixing] = useState(false);
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [owner, setOwner] = useState(props.setResponsible);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (decision: Decision, fix?: Record<string, string>) =>
    start(async () => {
      const r = await decideBatchRow({ rowId: props.rowId, decision, fix, setResponsible: owner });
      setMessage(r.ok ? null : r.error);
      if (r.ok) {
        setFixing(false);
        router.refresh();
      }
    });
  if (!props.editable) return <p className="mt-2 text-sm">Decision: {props.decision}</p>;
  return (
    <div className="mt-3 flex flex-col gap-2">
      {props.responsible ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} />
          Set {props.responsible} as who's responsible
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(["accept", "skip"] as const).map((d) => (
          <Button
            key={d}
            type="button"
            className="min-h-11"
            variant={props.decision === d ? "default" : "outline"}
            disabled={pending}
            onClick={() => send(d)}
          >
            {d === "accept" ? "Accept" : "Skip"}
          </Button>
        ))}
        <Button
          type="button"
          className="min-h-11"
          variant={props.decision === "fix" ? "default" : "outline"}
          disabled={pending}
          onClick={() => setFixing((f) => !f)}
        >
          Fix
        </Button>
      </div>
      {fixing ? (
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Field to fix"
            placeholder="Field, e.g. name"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
          <Input
            aria-label="Correct value"
            placeholder="Correct value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || !field}
            onClick={() => send("fix", { [field]: value })}
          >
            Save fix
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ApproveButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        className="min-h-11 self-start"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await approveImportBatch({ id });
            setMessage(
              r.ok
                ? `Approved. Added ${r.data.added}, already there ${r.data.alreadyThere}.`
                : r.error,
            );
            router.refresh();
          })
        }
      >
        Approve this upload
      </Button>
      {disabled ? (
        <p className="text-xs text-muted-foreground">Decide every waiting row first.</p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function UndoButton({ id }: { id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={sure ? "destructive" : "outline"}
        className="min-h-11 self-start"
        disabled={pending}
        onClick={() => {
          if (!sure) return setSure(true);
          start(async () => {
            const r = await undoImportBatch({ id });
            setMessage(
              r.ok
                ? `Undone. Removed ${r.data.removed}${r.data.keptInUse ? `, kept ${r.data.keptInUse} now in use` : ""}.`
                : r.error,
            );
            router.refresh();
          });
        }}
      >
        {sure ? "Yes, undo this import" : "Undo this import"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Removes only what this upload added. Things typed in by hand or from other uploads stay.
      </p>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
