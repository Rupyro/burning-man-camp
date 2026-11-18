import "server-only";
// Automatic rule 1 messages: tell the person a shift is open for them, and tell the duty lead
// who took a dropped shift. The places themselves move in the actions (standby.ts).
import type { JobFn } from "@/base/api";
import type { JobResult } from "@/contracts/automations";
import { formatCampDay, formatCampTime } from "@/lib/dates";
import { standbyActivity } from "./queries";

const when = (s: Date, e: Date) =>
  `${formatCampDay(s, "EEEE")} from ${formatCampTime(s, "HH:mm")} to ${formatCampTime(e, "HH:mm")}`;

const job: JobFn = async (ctx) => {
  const rows = await standbyActivity(ctx.db, ctx.edition.id, ctx.now);
  const out: Required<Pick<JobResult, "reminders">> = { reminders: [] };
  for (const r of rows) {
    const entity = { entityType: "shifts.standby", entityId: r.id };
    if (r.status === "offered")
      out.reminders.push({
        rule: "shifts.standby_offer",
        ...entity,
        personId: r.personId,
        stage: "offer",
        priority: 1,
        title: `A shift is open for you: ${r.dutyName} on ${when(r.startsAt, r.endsAt)}`,
        href: `/shifts/${r.slotId}`,
      });
    if (r.status === "took" && r.leadPersonId && r.leadPersonId !== r.personId)
      out.reminders.push({
        rule: "shifts.standby_took",
        ...entity,
        personId: r.leadPersonId,
        stage: "took",
        priority: 3,
        title: `${r.name} took ${r.droppedByName ? `${r.droppedByName}'s` : "the"} ${r.dutyName} shift on ${when(r.startsAt, r.endsAt)}. You don't need to do anything`,
        href: `/shifts/${r.slotId}`,
      });
  }
  return out;
};
export default job;
