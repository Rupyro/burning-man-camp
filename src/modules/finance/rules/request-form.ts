// The request form, checked in the browser before anything is sent (QA 21 Oct 2026). The server
// checks again; this is only so people see what's wrong next to the field.

import { MONEY_SYMBOL } from "@/lib/camp";
import { MAX_CENTS, parseRand } from "./money";

export const LIMITS = { title: 120, why: 2000, supplier: 120 } as const;

export interface RequestFormValues {
  title: string;
  amount: string;
  why: string;
  supplier: string;
}
export type RequestFormProblems = Partial<Record<keyof RequestFormValues, string>>;

const tooLong = (v: string, max: number) =>
  v.length > max ? `Keep it to ${max} characters (now ${v.length}).` : null;

function amountProblem(raw: string): string | null {
  const a = raw.trim();
  if (!a) return `Enter an amount, like 4500 or ${MONEY_SYMBOL}4,500.50.`;
  if (parseRand(a) !== null) return null;
  if (/^-/.test(a) || /^r?\s*0+(\.0+)?$/i.test(a)) return "The amount must be more than zero.";
  const digits = Number(a.replace(/^r\s*/i, "").replace(/[ ,]/g, ""));
  if (Number.isFinite(digits) && digits * 100 > MAX_CENTS)
    return `That amount is over ${MONEY_SYMBOL}10 million. Check it, or ask finance.`;
  return `Use an amount like 4500 or ${MONEY_SYMBOL}4,500.50 (numbers only).`;
}

/** Field → message for everything that would be refused; empty when the form is fine. */
export function checkRequestForm(v: RequestFormValues): RequestFormProblems {
  const out: RequestFormProblems = {};
  const title = v.title.trim();
  if (title.length < 3) out.title = "Say what you need (at least 3 letters).";
  else {
    const long = tooLong(title, LIMITS.title);
    if (long) out.title = long;
  }
  const amount = amountProblem(v.amount);
  if (amount) out.amount = amount;
  const why = tooLong(v.why.trim(), LIMITS.why);
  if (why) out.why = why;
  const supplier = tooLong(v.supplier.trim(), LIMITS.supplier);
  if (supplier) out.supplier = supplier;
  return out;
}
