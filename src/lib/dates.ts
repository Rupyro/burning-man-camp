import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const CAMP_TIMEZONE = "Africa/Johannesburg";

/** Format an instant in camp time with a short label, e.g. "Mon 26 Apr 2027, 09:00 SAST". */
export function formatCampTime(at: Date, pattern = "EEE d MMM yyyy, HH:mm"): string {
  return `${format(new TZDate(at, CAMP_TIMEZONE), pattern)} SAST`;
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 86_400_000);
}

/** Form helpers: "2027-04-21" + "08:00" in camp time → the instant (time defaults to 00:00). */
export function campInputToInstant(date: string, time: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time || "00:00");
  if (!d || !t) throw new Error("Use a date like 2027-04-21 and a time like 08:00");
  return new Date(
    new TZDate(
      Number(d[1]),
      Number(d[2]) - 1,
      Number(d[3]),
      Number(t[1]),
      Number(t[2]),
      CAMP_TIMEZONE,
    ).getTime(),
  );
}

/** The reverse, for prefilling a form: the instant as camp-time date and time. */
export function instantToCampInput(at: Date): { date: string; time: string } {
  const z = new TZDate(at, CAMP_TIMEZONE);
  return { date: format(z, "yyyy-MM-dd"), time: format(z, "HH:mm") };
}

/** A camp-time date without the zone label, for compact chips and tables ("21 Apr"). */
export function formatCampDay(at: Date, pattern = "d MMM"): string {
  return format(new TZDate(at, CAMP_TIMEZONE), pattern);
}
