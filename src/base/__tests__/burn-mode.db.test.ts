// Burn Mode: opt-in per person, own row only, and pre-Burn noise is silenced in notify().
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { notify } from "@/base/engine/notify";
import {
  burnStateOf,
  dismissMyBurnPrompt,
  isInBurnMode,
  setMyBurnAsk,
  setMyBurnMode,
} from "@/base/people/burn-mode";
import { notifications } from "@/base/schema";

const T = new Date("2027-04-26T08:00:00Z");
let sam: string;
let alex: string;
const as = async (id: string) => ({
  db: getDb(),
  actor: await actorFor(id),
  edition: EDITION,
  now: T,
});
const notice = (recipientPersonId: string, type: string, href = "/tasks") => ({
  recipientPersonId,
  type,
  entityType: "base.task",
  entityId: "00000000-0000-4000-8000-000000000001",
  title: type,
  href,
});

describe("Burn Mode", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    sam = await createPerson({ email: "s@example.test", name: "Sam" });
    alex = await createPerson({ email: "a@example.test", name: "Alex" });
  });

  it("is off by default and switches on and off for the caller only", async () => {
    expect((await burnStateOf(getDb(), EDITION.id, sam)).onAt).toBeNull();
    await setMyBurnMode(await as(sam), true);
    expect((await burnStateOf(getDb(), EDITION.id, sam)).onAt).toEqual(T);
    expect(await isInBurnMode(getDb(), sam)).toBe(true);
    expect(await isInBurnMode(getDb(), alex)).toBe(false);
    await setMyBurnMode(await as(sam), false);
    expect(await isInBurnMode(getDb(), sam)).toBe(false);
  });

  it("'Ask me on my arrival day' off records an answer; on clears it again", async () => {
    await setMyBurnAsk(await as(alex), false);
    expect((await burnStateOf(getDb(), EDITION.id, alex)).promptDismissedAt).toEqual(T);
    await setMyBurnAsk(await as(alex), true);
    expect((await burnStateOf(getDb(), EDITION.id, alex)).promptDismissedAt).toBeNull();
    expect((await burnStateOf(getDb(), EDITION.id, sam)).promptDismissedAt).toBeNull();
  });

  it("records 'Not yet' on the arrival prompt; switching on answers it too", async () => {
    await dismissMyBurnPrompt(await as(alex));
    expect((await burnStateOf(getDb(), EDITION.id, alex)).promptDismissedAt).toEqual(T);
    await setMyBurnMode(await as(sam), true);
    expect((await burnStateOf(getDb(), EDITION.id, sam)).promptDismissedAt).toEqual(T);
  });

  it("refuses someone who isn't on this year's camp list", async () => {
    const out = await createPerson({
      email: "o@example.test",
      name: "Out",
      status: null,
    });
    await expect(setMyBurnMode(await as(out), true)).rejects.toThrow(/camp list/);
  });

  it("silences nudges, alerts and Money notices, but not shift changes or other people", async () => {
    await setMyBurnMode(await as(sam), true);
    expect(await notify(getDb(), notice(sam, "task.nudge"))).toBeNull();
    expect(await notify(getDb(), notice(sam, "task.overdue"))).toBeNull();
    expect(await notify(getDb(), notice(sam, "task.assigned", "/finance/r/1"))).toBeNull();
    expect(await notify(getDb(), notice(sam, "shifts.swap", "/shifts/s/1"))).not.toBeNull();
    expect(await notify(getDb(), notice(alex, "task.nudge"))).not.toBeNull();
    const rows = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.recipientPersonId, sam));
    expect(rows.map((r) => r.type)).toEqual(["shifts.swap"]);
  });
});
