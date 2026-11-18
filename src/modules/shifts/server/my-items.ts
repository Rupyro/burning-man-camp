import type { MyItem, MyItemsProvider } from "@/base/api";
import { formatCampDay } from "@/lib/dates";
import { plannedEnough } from "../rules/contribution";
import { myContribution, settingsOf, signupsOpenAt, standbyActivity } from "./queries";

/**
 * Up next shows only shift decisions and actions, never "your next shift" (plan-shifts.md).
 * PR 2: before the freeze, one action if your planned shifts don't reach the minimums yet.
 * Before the roster exists, one heads-up row when the sign-up opening date is known (spec B3.2).
 */
export const myShiftItems: MyItemsProvider = async (ctx) => {
  const me = ctx.actor.personId;
  if (!me || !ctx.actor.isConfirmedMember) return [];
  const offers = (await standbyActivity(ctx.db, ctx.edition.id, ctx.now))
    .filter((r) => r.status === "offered" && r.personId === me && r.startsAt > ctx.now)
    .map(
      (r): MyItem => ({
        id: `shifts:standby:${r.id}`,
        moduleId: "shifts",
        kind: "shift",
        title: `A shift is open for you: ${r.dutyName}, ${formatCampDay(r.startsAt)}`,
        dueAt: r.startsAt,
        urgency: "soon",
        href: `/shifts/${r.slotId}`,
      }),
    );
  return [...offers, ...(await planItems(ctx, me))];
};

async function planItems(ctx: Parameters<MyItemsProvider>[0], me: string): Promise<MyItem[]> {
  const settings = await settingsOf(ctx.db, ctx.edition.id);
  if (!settings) {
    const opens = await signupsOpenAt(ctx.db, ctx.edition.id);
    if (!opens || opens <= ctx.now) return [];
    return [
      {
        id: `shifts:opens:${ctx.edition.id}`,
        moduleId: "shifts",
        kind: "deadline",
        title: `Pick your shifts (sign-ups open ${formatCampDay(opens)})`,
        dueAt: opens,
        urgency: "normal",
        href: "/shifts",
      },
    ];
  }
  if (ctx.now >= settings.freezeAt) return [];
  const c = await myContribution(ctx.db, ctx.edition.id, me);
  if (!c || plannedEnough(c)) return [];
  const soon = settings.freezeAt.getTime() - ctx.now.getTime() < 14 * 86_400_000;
  return [
    {
      id: `shifts:signup:${ctx.edition.id}`,
      moduleId: "shifts",
      kind: "deadline",
      title: `Pick your shifts before sign-up closes on ${formatCampDay(settings.freezeAt)}`,
      dueAt: settings.freezeAt,
      urgency: soon ? "soon" : "normal",
      href: "/shifts",
    },
  ];
}
