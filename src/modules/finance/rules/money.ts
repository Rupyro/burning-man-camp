// Money is integer cents in rand (docs/specs/finance.md §3). Never floats.
// The symbol comes from camp.config.ts (money.symbol); names keep "Rand" for now.
import { MONEY_SYMBOL } from "@/lib/camp";

const SYMBOL_PREFIX = new RegExp(
  `^${MONEY_SYMBOL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
  "i",
);

/** R10 million: anything bigger is a typo. */
export const MAX_CENTS = 1_000_000_000;

const PATTERN = /^(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** "4500", "4 500", "R4,500.50" → cents. Null for anything else, zero, or over the cap. */
export function parseRand(input: string): number | null {
  const s = input.trim().replace(SYMBOL_PREFIX, "");
  const m = PATTERN.exec(s);
  if (!m) return null;
  const [whole = "", part = ""] = s.split(".");
  const cents = Number(whole.replace(/[ ,]/g, "")) * 100 + Number(part.padEnd(2, "0"));
  if (cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

/** 450000 → "R4,500"; 432050 → "R4,320.50"; negatives get a real minus sign. */
export function formatRand(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const part = abs % 100;
  return `${sign}${MONEY_SYMBOL}${whole}${part ? `.${String(part).padStart(2, "0")}` : ""}`;
}

/** Plain decimal rands for CSV: 95001 → "950.01". */
export function csvRand(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
