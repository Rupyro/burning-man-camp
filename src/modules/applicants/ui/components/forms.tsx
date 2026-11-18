"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "../../rules/form";
import {
  confirmDocument,
  markGuideRead,
  saveApplication,
  updateApplication,
} from "../../server/actions";

const field =
  "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function Status({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
}

/** The PLACEHOLDER application form: save a draft any time, send when every * question is done. */
export function ApplicationForm(p: {
  fields: readonly FormField[];
  answers: Record<string, string>;
  sent: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (form: HTMLFormElement, submit: boolean) => {
    const data = new FormData(form);
    const answers: Record<string, string> = {};
    for (const f of p.fields) answers[f.key] = String(data.get(f.key) ?? "");
    setMsg(null);
    start(async () => {
      try {
        const r = await saveApplication({ answers, submit });
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        if (!r.ok) {
          setErrors(r.errors);
          setMsg("A few answers need a look (marked below).");
          return;
        }
        setErrors({});
        if (submit && !p.sent) router.push("/apply?sent=1");
        else {
          setMsg(submit ? "Changes saved." : "Draft saved.");
          router.refresh();
        }
      } catch {
        setMsg("That didn't save. Please try again.");
      }
    });
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(e.currentTarget, true);
      }}
    >
      <fieldset disabled={p.locked || pending} className="flex flex-col gap-4">
        <legend className="sr-only">Application questions</legend>
        {p.fields.map((f) => {
          const err = errors[f.key];
          const id = `q-${f.key}`;
          const common = {
            id,
            name: f.key,
            defaultValue: p.answers[f.key] ?? "",
            "aria-invalid": err ? true : undefined,
            "aria-describedby": err ? `${id}-err` : f.hint ? `${id}-hint` : undefined,
          };
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <Label htmlFor={id}>
                {f.label}
                {f.required ? <span aria-hidden> *</span> : null}
                {f.required ? <span className="sr-only"> (required)</span> : null}
              </Label>
              {f.hint ? (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                  {f.hint}
                </p>
              ) : null}
              {f.kind === "textarea" ? (
                <textarea {...common} rows={4} maxLength={f.max} className={field} />
              ) : f.kind === "choice" ? (
                <select {...common} className={field}>
                  <option value="">Choose…</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <Input {...common} maxLength={f.max} className="min-h-11" />
              )}
              {err ? (
                <p id={`${id}-err`} className="text-sm font-semibold text-destructive">
                  {err}
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {p.locked ? null : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending} className="min-h-11">
            {p.sent ? "Save changes" : "Send application"}
          </Button>
          {p.sent ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={(e) => {
                const form = e.currentTarget.form;
                if (form) run(form, false);
              }}
            >
              Save draft
            </Button>
          )}
        </div>
      )}
      <Status msg={msg} />
    </form>
  );
}

/** "I've read this" for one required document. */
export function ConfirmDocButton({ docKey, title }: { docKey: string; title: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        className="min-h-11 self-start"
        aria-label={`Confirm: ${title}`}
        onClick={() =>
          start(async () => {
            try {
              const r = await confirmDocument({ docKey });
              if (isActionFailure(r)) {
                setMsg(r.error);
                return;
              }
              if (r.joined) router.push("/");
              else router.refresh();
            } catch {
              setMsg("That didn't save. Please try again.");
            }
          })
        }
      >
        {pending ? "Saving…" : "I've read this and agree"}
      </Button>
      <Status msg={msg} />
    </div>
  );
}

/** A lead's update: next status, interview date and time (camp time), private note. */
export function ReviewForm(p: {
  id: string;
  moves: readonly { value: string; label: string }[];
  interview: { date: string; time: string };
  note: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const status = String(f.get("status") ?? "");
        const date = String(f.get("date") ?? "");
        const time = String(f.get("time") ?? "");
        setMsg(null);
        start(async () => {
          try {
            const r = await updateApplication({
              id: p.id,
              status: status ? (status as "applied") : undefined,
              interviewDate: date || undefined,
              interviewTime: time || undefined,
              note: String(f.get("note") ?? ""),
            });
            setMsg(
              r.error ??
                (r.joined
                  ? "Saved. They've joined the camp."
                  : r.changed
                    ? "Saved."
                    : "Nothing changed."),
            );
            router.refresh();
          } catch {
            setMsg("That didn't work. You may not be allowed to do this.");
          }
        });
      }}
    >
      {p.moves.length ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="status">Move to</Label>
          <select id="status" name="status" className={field} defaultValue="">
            <option value="">Keep the current status</option>
            {p.moves.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date">Interview date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={p.interview.date}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="time">Time (camp time)</Label>
          <Input
            id="time"
            name="time"
            type="time"
            defaultValue={p.interview.time}
            className="min-h-11"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="note">Lead note (only leads see this)</Label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={p.note}
          className={field}
        />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
      <Status msg={msg} />
    </form>
  );
}

/** Welcome list: "I've read the camp guide" (one tap; the home row goes away). */
export function GuideReadButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="min-h-11 self-start"
        onClick={() =>
          start(async () => {
            try {
              const r = await markGuideRead({});
              if (isActionFailure(r)) setMsg(r.error);
              else router.refresh();
            } catch {
              setMsg("That didn't work. Please try again.");
            }
          })
        }
      >
        {pending ? "Saving…" : "I've read it"}
      </Button>
      <Status msg={msg} />
    </div>
  );
}
