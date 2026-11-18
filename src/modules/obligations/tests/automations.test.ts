// AfrikaBurn deadline reminders, rule 15 (automation plan).
import { describe, expect, it } from "vitest";
import { type DeadlineFact, deadlineReminders } from "../rules/automations";

const NOW = new Date("2027-03-01T08:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000 + 3_600_000);
const d = (left: number, over: Partial<DeadlineFact> = {}): DeadlineFact => ({
  taskId: "o1",
  title: "WAP requests",
  dueAt: day(left),
  ownerPersonId: "owner",
  missingDocuments: [],
  ...over,
});
const who = (left: number, over?: Partial<DeadlineFact>) =>
  deadlineReminders([d(left, over)], ["lead", "owner"], NOW).map((r) => `${r.personId}:${r.stage}`);

describe("rule 15: deadline reminders", () => {
  it("owner at 30, 14 and 7 days; team leads at 7 and 2; never the owner twice", () => {
    expect(who(31)).toEqual([]);
    expect(who(30)).toEqual(["owner:d-30"]);
    expect(who(10)).toEqual(["owner:d-14"]);
    expect(who(7)).toEqual(["owner:d-7", "lead:d-7"]);
    expect(who(1)).toEqual(["owner:d-7", "lead:d-2"]);
    expect(who(-1)).toEqual([]); // overdue: the base alert takes over
    expect(who(5, { ownerPersonId: null })).toEqual(["lead:d-7", "owner:d-7"]);
  });
  it("says which documents are still needed", () => {
    const [r] = deadlineReminders([d(1, { missingDocuments: ["Builder list"] })], [], NOW);
    expect(r?.title).toBe("WAP requests is due in 1 day; still needed: Builder list");
    expect(r?.priority).toBe(0);
  });
});
