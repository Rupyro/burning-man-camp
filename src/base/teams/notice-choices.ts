// End-time buttons for a new team notice, in camp time: tap one instead of typing a date.
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { CAMP_TIMEZONE } from "@/lib/dates";

const at6pm = (now: Date, addDays: number) => {
  const z = new TZDate(now, CAMP_TIMEZONE);
  return new Date(
    new TZDate(
      z.getFullYear(),
      z.getMonth(),
      z.getDate() + addDays,
      18,
      0,
      CAMP_TIMEZONE,
    ).getTime(),
  );
};

/** Tonight 6pm (if still to come), tomorrow 6pm, the coming Friday 6pm, and a week from today. */
export function noticeEndChoices(now: Date): { label: string; at: string }[] {
  const out: { label: string; at: Date }[] = [];
  const tonight = at6pm(now, 0);
  if (tonight > now) out.push({ label: "Tonight 6pm", at: tonight });
  out.push({ label: "Tomorrow 6pm", at: at6pm(now, 1) });
  const dow = new TZDate(now, CAMP_TIMEZONE).getDay();
  const toFri = (5 - dow + 7) % 7 || 7;
  if (toFri > 1 && toFri < 7)
    out.push({
      label: `Friday 6pm (${format(new TZDate(at6pm(now, toFri), CAMP_TIMEZONE), "d MMM")})`,
      at: at6pm(now, toFri),
    });
  out.push({ label: "In a week", at: at6pm(now, 7) });
  return out.map((c) => ({ label: c.label, at: c.at.toISOString() }));
}
