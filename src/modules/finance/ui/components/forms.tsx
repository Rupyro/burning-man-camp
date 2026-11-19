"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MONEY_UNIT } from "@/lib/camp";
import { checkRequestForm, LIMITS, type RequestFormProblems } from "../../rules/request-form";
import { createRequest, editRequest } from "../../server/requests";

export function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string, then?: (r: unknown) => void) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        setMsg(done);
        if (then) then(r);
        else router.refresh();
      } catch (e) {
        setMsg(
          e instanceof Error && e.name === "ValidationError"
            ? e.message
            : "That didn't work. Check the details, or you may not be allowed to do this.",
        );
      }
    });
  };
  return { msg, pending, run, router };
}

export function Status({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
}

export function Form(props: {
  onSubmit: (f: FormData, submitter: string) => void;
  children: ReactNode;
  /** Skip the browser's own bubbles when the form shows its own field messages. */
  noValidate?: boolean;
}) {
  return (
    <form
      noValidate={props.noValidate}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const via = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        props.onSubmit(new FormData(e.currentTarget), via?.value ?? "");
      }}
    >
      {props.children}
    </form>
  );
}

export const field = "min-h-11";
export const area = "rounded-md border bg-card p-2";
export const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A field's message under it (linked for screen readers), or the character count near a limit. */
function FieldNote(p: { id: string; problem?: string; count?: number; max?: number }) {
  if (p.problem)
    return (
      <p id={`${p.id}-msg`} role="alert" className="text-sm font-semibold text-destructive">
        {p.problem}
      </p>
    );
  return p.max ? (
    <p id={`${p.id}-msg`} className="text-xs text-muted-foreground">
      {p.count ?? 0} / {p.max} characters
    </p>
  ) : null;
}

/** New request, or editing a draft / sent-back one. "Send for approval" submits too. */
export function RequestForm(props: {
  teams?: { id: string; name: string }[];
  id?: string;
  values?: {
    title: string;
    amount: string;
    justification: string;
    supplierName: string;
    neededBy: string;
  };
}) {
  const { msg, pending, run, router } = useAction();
  const v = props.values;
  const [problems, setProblems] = useState<RequestFormProblems>({});
  const [title, setTitle] = useState(v?.title ?? "");
  const [why, setWhy] = useState(v?.justification ?? "");
  const aria = (k: keyof RequestFormProblems) => ({
    "aria-invalid": problems[k] ? true : undefined,
    "aria-describedby": `${k}-msg`,
  });
  return (
    <Form
      noValidate
      onSubmit={(f, via) => {
        const found = checkRequestForm({
          title: s(f, "title"),
          amount: s(f, "amount"),
          why: s(f, "why"),
          supplier: s(f, "supplier"),
        });
        setProblems(found);
        if (Object.keys(found).length) return;
        const common = {
          title: s(f, "title"),
          amount: s(f, "amount"),
          justification: s(f, "why") || null,
          supplierName: s(f, "supplier") || null,
          neededBy: s(f, "needed") || null,
          submit: via === "submit",
        };
        const id = props.id;
        run(
          () =>
            id
              ? editRequest({ id, ...common })
              : createRequest({ teamId: s(f, "team"), ...common }),
          via === "submit" ? "Sent for approval." : "Saved as a draft.",
          (r) => router.push(`/finance/r/${(r as { id: string }).id}`),
        );
      }}
    >
      {props.teams ? (
        <>
          <Label htmlFor="team">For which team?</Label>
          <select id="team" name="team" className={`${field} rounded-md border bg-card px-2`}>
            {props.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <Label htmlFor="title">What do you need?</Label>
      <Input
        id="title"
        name="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={field}
        placeholder="Gas bottles (4 × 9 kg)"
        {...aria("title")}
      />
      <FieldNote id="title" problem={problems.title} count={title.length} max={LIMITS.title} />
      <Label htmlFor="amount">About how much? ({MONEY_UNIT})</Label>
      <Input
        id="amount"
        name="amount"
        required
        inputMode="decimal"
        defaultValue={v?.amount}
        className={field}
        placeholder="4500"
        {...aria("amount")}
      />
      <FieldNote id="amount" problem={problems.amount} />
      <Label htmlFor="why">Why (helps the approver say yes)</Label>
      <textarea
        id="why"
        name="why"
        rows={3}
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        className={area}
        {...aria("why")}
      />
      <FieldNote id="why" problem={problems.why} count={why.length} max={LIMITS.why} />
      <Label htmlFor="supplier">Where from? (optional)</Label>
      <Input
        id="supplier"
        name="supplier"
        defaultValue={v?.supplierName}
        className={field}
        {...aria("supplier")}
      />
      <FieldNote id="supplier" problem={problems.supplier} />
      <Label htmlFor="needed">Needed by (optional)</Label>
      <Input id="needed" name="needed" type="date" defaultValue={v?.neededBy} className={field} />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" name="via" value="submit" disabled={pending} className="min-h-11">
          {pending ? "Sending…" : "Send for approval"}
        </Button>
        <Button
          type="submit"
          name="via"
          value="draft"
          variant="outline"
          disabled={pending}
          className="min-h-11"
        >
          Save draft
        </Button>
      </div>
      {Object.keys(problems).length ? (
        <p role="status" className="text-sm font-semibold">
          Fix the fields marked above, then try again.
        </p>
      ) : null}
      <Status msg={msg} />
    </Form>
  );
}
