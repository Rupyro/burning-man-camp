"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DecisionNext,
  type DecisionReason,
  decisionProblem,
  defaultReason,
  NEXT_FOR,
  NEXT_LABEL,
  REASON_LABEL,
  REASONS_FOR,
} from "../../rules/decision-reasons";
import { formatRand } from "../../rules/money";
import { recordExpense, settleReimbursement } from "../../server/money";
import { cancelRequest, decideRequest, resubmitCopy, submitRequest } from "../../server/requests";
import { area, Form, field, Status, s, useAction } from "./forms";

type Decision = "approved" | "rejected" | "needs_info";
const STEP1: [Decision, string][] = [
  ["approved", "Approve"],
  ["needs_info", "Ask for info"],
  ["rejected", "Reject"],
];
const DONE: Record<Decision, string> = {
  approved: "Approved.",
  needs_info: "Sent back.",
  rejected: "Turned down.",
};

/** A row of big tap targets; the chosen one is pressed. */
function Taps<T extends string>(props: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onPick: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <Button
            key={o}
            type="button"
            variant={props.value === o ? "default" : "outline"}
            aria-pressed={props.value === o}
            disabled={props.disabled}
            className="min-h-11"
            onClick={() => props.onPick(o)}
          >
            {props.labels[o]}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The decision tree (plan-money-taps.md): 1 decide, 2 reason (pre-selected only for approve),
 * 3 what happens next (only for some reasons). A note is optional except for "Other".
 * Approve → Done is two taps; nothing needs typing.
 */
export function DecisionForm({
  id,
  estimatedCents,
  budgets,
  currentBudgetId,
}: {
  id: string;
  estimatedCents: number;
  budgets: { id: string; label: string }[];
  currentBudgetId: string;
}) {
  const { msg, pending, run } = useAction();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState<DecisionReason | null>(null);
  const [next, setNext] = useState<DecisionNext | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const pick = (d: Decision) => {
    setDecision(d);
    setReason(defaultReason(d));
    setNext(null);
  };
  const nexts = reason ? (NEXT_FOR[reason] ?? []) : [];
  const caps = [0.5, 0.75].map((f) => Math.round((estimatedCents * f) / 100) * 100);
  const moveTo = budgets.filter((b) => b.id !== currentBudgetId);
  const problem =
    decision && reason
      ? decisionProblem({
          decision,
          reason,
          next,
          note,
          capAmountCents: next === "cap_amount" ? cap : null,
          moveToBudgetId: next === "move_budget" ? budget : null,
        })
      : decision
        ? "Pick a reason"
        : "Pick one";
  const send = () => {
    if (!decision || !reason || problem) return;
    run(
      () =>
        decideRequest({
          id,
          decision,
          reason,
          next,
          capAmount: next === "cap_amount" && cap ? (cap / 100).toFixed(2) : null,
          moveToBudgetId: next === "move_budget" ? budget : null,
          comment: note.trim() || null,
        }),
      DONE[decision],
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <Taps
        label="1. Decide"
        options={STEP1.map(([d]) => d)}
        labels={Object.fromEntries(STEP1) as Record<Decision, string>}
        value={decision}
        onPick={pick}
        disabled={pending}
      />
      {decision ? (
        <Taps
          label="2. Why"
          options={[...REASONS_FOR[decision], "other"]}
          labels={REASON_LABEL}
          value={reason}
          onPick={(v) => {
            setReason(v);
            setNext(null);
          }}
          disabled={pending}
        />
      ) : null}
      {nexts.length ? (
        <Taps
          label="3. What happens next"
          options={nexts}
          labels={NEXT_LABEL}
          value={next}
          onPick={setNext}
          disabled={pending}
        />
      ) : null}
      {next === "cap_amount" ? (
        <Taps
          label="Cap at"
          options={caps.map(String)}
          labels={Object.fromEntries(caps.map((c) => [String(c), formatRand(c)]))}
          value={cap === null ? null : String(cap)}
          onPick={(v) => setCap(Number(v))}
          disabled={pending}
        />
      ) : null}
      {next === "move_budget" ? (
        <Taps
          label="Move to"
          options={moveTo.map((b) => b.id)}
          labels={Object.fromEntries(moveTo.map((b) => [b.id, b.label]))}
          value={budget}
          onPick={setBudget}
          disabled={pending}
        />
      ) : null}
      {decision ? (
        <>
          <Label htmlFor="note">
            {reason === "other" ? "Note (needed for Other)" : "Note (optional)"}
          </Label>
          <textarea
            id="note"
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={area}
          />
          <Button
            type="button"
            disabled={pending || problem !== null}
            className="min-h-11 self-start"
            onClick={send}
          >
            {pending ? "Saving…" : "Done"}
          </Button>
          {problem && decision ? <p className="text-sm">{problem}</p> : null}
        </>
      ) : null}
      <Status msg={msg} />
    </div>
  );
}

/** Requester, after "Resubmit lower" or "Move to the right budget": one tap to a new draft. */
export function ResubmitButton({ id }: { id: string }) {
  const { msg, pending, run, router } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        disabled={pending}
        className="min-h-11 self-start"
        onClick={() =>
          run(
            () => resubmitCopy({ id }),
            "New draft made.",
            (r) => router.push(`/finance/r/${(r as { id: string }).id}`),
          )
        }
      >
        Make a new request from this
      </Button>
      <Status msg={msg} />
    </div>
  );
}

/** After buying: what it cost, how it was paid, and a link to the receipt photo. */
export function ExpenseForm({ id, today }: { id: string; today: string }) {
  const { msg, pending, run } = useAction();
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            recordExpense({
              id,
              amount: s(f, "cost"),
              spentOn: s(f, "on"),
              paidWith: s(f, "paid") as "personal",
              description: s(f, "desc"),
              receiptUrl: s(f, "receipt") || null,
            }),
          "Saved. Thanks!",
        )
      }
    >
      <Label htmlFor="cost">What did it cost? (rand)</Label>
      <Input id="cost" name="cost" required inputMode="decimal" className={field} />
      <Label htmlFor="on">When</Label>
      <Input id="on" name="on" type="date" required defaultValue={today} className={field} />
      <Label htmlFor="paid">Paid with</Label>
      <select id="paid" name="paid" className={`${field} rounded-md border bg-card px-2`}>
        <option value="personal">My own money (pay me back)</option>
        <option value="camp_card">Camp card</option>
        <option value="camp_cash">Camp cash</option>
        <option value="supplier_invoice">Supplier invoice</option>
      </select>
      <Label htmlFor="desc">What you bought</Label>
      <Input id="desc" name="desc" required minLength={2} maxLength={500} className={field} />
      <Label htmlFor="receipt">Link to the receipt photo</Label>
      <Input id="receipt" name="receipt" type="url" className={field} placeholder="https://…" />
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? "Saving…" : "Save what it cost"}
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

/** Finance: mark a pay-back paid (a short note like "EFT 3 Mar"; never bank details). */
export function SettleForm({ reimbursementId }: { reimbursementId: string }) {
  const { msg, pending, run } = useAction();
  return (
    <Form
      onSubmit={(f, via) =>
        run(
          () =>
            settleReimbursement({
              reimbursementId,
              outcome: via as "paid" | "declined",
              methodNote: s(f, "note") || null,
            }),
          via === "paid" ? "Marked paid." : "Declined.",
        )
      }
    >
      <Label htmlFor="note">How it was paid (no account numbers)</Label>
      <Input id="note" name="note" maxLength={80} className={field} placeholder="EFT 3 Mar" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" value="paid" disabled={pending} className="min-h-11">
          Mark paid
        </Button>
        <Button
          type="submit"
          value="declined"
          variant="outline"
          disabled={pending}
          className="min-h-11"
        >
          Decline
        </Button>
      </div>
      <Status msg={msg} />
    </Form>
  );
}

/** Requester's one-tap actions: send a draft, cancel, or put away a turned-down request. */
export function RequesterButtons({
  id,
  canSubmit,
  cancelLabel,
}: {
  id: string;
  canSubmit: boolean;
  cancelLabel: string | null;
}) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <Button
            disabled={pending}
            className="min-h-11"
            onClick={() => run(() => submitRequest({ id }), "Sent for approval.")}
          >
            Send for approval
          </Button>
        ) : null}
        {cancelLabel ? (
          <Button
            variant="outline"
            disabled={pending}
            className="min-h-11"
            onClick={() => run(() => cancelRequest({ id }), "Done.")}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
      <Status msg={msg} />
    </div>
  );
}
