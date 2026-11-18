// Spend request references like OEA-SR-017 (ported from Ruchir's camp-finance spike, rewritten
// without its prefix helper: the prefix comes from camp_settings.ref_prefix).

export function spendRef(prefix: string, sequence: number): string {
  const p = prefix.trim().toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(p)) throw new Error("Reference prefix must be 2–6 letters");
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new Error("Reference sequence must be a positive whole number");
  return `${p}-SR-${String(sequence).padStart(3, "0")}`;
}

/** Find a spend ref in free text (a receipt note, a bank memo). */
export function findSpendRef(text: string): string | null {
  return /\b([A-Z]{2,6}-SR-\d{3,})\b/.exec(text.toUpperCase())?.[1] ?? null;
}
