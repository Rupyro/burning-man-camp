// Admin daily review (Oct 28 2026): what counts as "yesterday", which drafts are flagged, and
// the AI spend line.

import { MONEY_SYMBOL } from "@/lib/camp";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";

export const STALE_DRAFT_DAYS = 2;
const DAY = 86_400_000;

/** Yesterday in camp time, midnight to midnight. */
export function yesterdayOf(now: Date) {
  const today = instantToCampInput(now).date;
  const end = campInputToInstant(today, "00:00");
  const date = instantToCampInput(new Date(end.getTime() - DAY / 2)).date;
  return { date, start: campInputToInstant(date, "00:00"), end };
}

export function isStaleDraft(d: { status: string; createdAt: Date }, now: Date) {
  return d.status === "draft" && now.getTime() - d.createdAt.getTime() >= STALE_DRAFT_DAYS * DAY;
}

const rand = (cents: number) => `${MONEY_SYMBOL}${Math.round(cents / 100)}`;

export function spendLine(spentCents: number, capCents: number) {
  if (capCents <= 0)
    return `The AI is off (the monthly limit is ${MONEY_SYMBOL}0), so only the demo version runs.`;
  const head = `This month the AI has cost ${rand(spentCents)}`;
  if (spentCents >= capCents)
    return `${head} and reached the ${rand(capCents)} limit, so the demo version is used until next month.`;
  if (spentCents >= capCents * 0.8) return `${head}, close to the ${rand(capCents)} limit.`;
  return `${head}, which is under the ${rand(capCents)} limit.`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-29" → "Thursday, 29 Oct". Anything else is shown as it is. */
export function friendlyReviewDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [y, mo, day] = (m ?? []).slice(1).map(Number);
  if (!y || !mo || !day) return date;
  const d = new Date(Date.UTC(y, mo - 1, day));
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
