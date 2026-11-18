// The automations job end to end (automation plan rules 11 + anti-spam): a request waits, the
// approver is reminded once by digest, the camp lead gets one handover, quiet hours send nothing.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { runAutomations } from "@/base/engine/automations";
import { runTick } from "@/base/engine/tick";
import { alertStates, notifications } from "@/base/schema";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";
import { myFinanceItems } from "@/modules/finance/server/my-items";
import { createRequest } from "@/modules/finance/server/requests";
import { financeCamp } from "@/modules/finance/tests/fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;
/** `n` days from now at `time` camp time. */
const at = (n: number, time: string) =>
  campInputToInstant(instantToCampInput(new Date(Date.now() + n * 86_400_000)).date, time);
const inbox = async (personId: string) =>
  getDb()
    .select({
      type: notifications.type,
      title: notifications.title,
      urgency: notifications.urgency,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientPersonId, personId),
        eq(notifications.type, "finance.approval_waiting"),
      ),
    );

describe("automations job", () => {
  beforeEach(async () => {
    p = await financeCamp();
    await actAs(p.member);
    await ok(
      createRequest({ teamId: p.kitchen, title: "Gas bottles", amount: "4500", submit: true }),
    );
  });

  it("reminds the approver once, by digest only, then hands over to the camp leads", async () => {
    expect(await runAutomations(getDb(), EDITION, at(4, "10:00"))).toMatchObject({ reminded: 1 });
    await runAutomations(getDb(), EDITION, at(4, "11:00"));
    expect(await inbox(p.finance)).toEqual([
      {
        type: "finance.approval_waiting",
        title: expect.stringMatching(/^TST-SR-001 is waiting for your decision/),
        urgency: "digest",
      },
    ]);
    expect(await inbox(p.member)).toEqual([]); // the requester is never the approver
    const later = at(7, "10:00");
    expect(await runAutomations(getDb(), EDITION, later)).toMatchObject({ handedOver: 1 });
    expect(await runAutomations(getDb(), EDITION, later)).toMatchObject({ handedOver: 0 });
    for (const lead of [p.camp, p.camp2]) {
      const [n] = await inbox(lead);
      expect(n?.title).toMatch(
        /^Request waiting [67] days: TST-SR-001 Gas bottles \(approver reminded/,
      );
    }
    const items = await myFinanceItems({
      actor: await actorFor(p.camp),
      edition: EDITION,
      now: later,
      db: getDb(),
    });
    expect(items.filter((i) => i.kind === "handover")).toEqual([
      expect.objectContaining({
        title: expect.stringMatching(/^Request waiting [67] days: TST-SR-001 Gas bottles$/),
        reason: "approver reminded, no decision",
      }),
    ]);
    const states = await getDb().select().from(alertStates);
    expect(states.map((s) => s.level).sort()).toEqual([0, 2]);
  });

  it("sends nothing in quiet hours; the tick runs it between alerts and the digest", async () => {
    expect(await runAutomations(getDb(), EDITION, at(4, "22:30"))).toMatchObject({
      skipped: "quiet_hours",
    });
    expect(await inbox(p.finance)).toEqual([]);
    const result = await runTick(getDb(), at(4, "07:10"));
    expect(Object.keys(result)).toEqual(["alerts", "automations", "digest", "outbox"]);
    expect(result.automations).toMatchObject({ reminded: 1, failed: [] });
    expect(result.digest).toMatchObject({ people: 1 });
  });
});
