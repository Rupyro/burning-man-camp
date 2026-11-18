// Team notices: a lead posts to their own team with an end time; members see it until it ends
// or they tap "Got it"; the lead sees who has read it, also after it ends.
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { teams } from "@/base/schema";
import {
  activeNoticesFor,
  endNoticeNow,
  markNoticeRead,
  noticesForLead,
  postNotice,
} from "@/base/teams/notices";

const T = new Date("2026-11-10T08:00:00Z");
const hours = (h: number) => new Date(T.getTime() + h * 3_600_000);
let lead: string;
let sam: string;
let jo: string;
let outsider: string;
let admin: string;
let kitchenId: string;
let giftId: string;
const as = async (id: string, now = T) => ({
  db: getDb(),
  actor: await actorFor(id),
  edition: EDITION,
  now,
});

describe("team notices", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    lead = await createPerson({
      email: "l@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    });
    sam = await createPerson({
      email: "s@example.test",
      name: "Sam",
      teams: [{ key: "kitchen", role: "member" }],
    });
    jo = await createPerson({
      email: "j@example.test",
      name: "Jo",
      teams: [{ key: "kitchen", role: "member" }],
    });
    outsider = await createPerson({
      email: "o@example.test",
      name: "Olu",
      teams: [{ key: "gift_projects", role: "member" }],
    });
    admin = await createPerson({ email: "a@example.test", name: "Admin", roles: ["admin"] });
    const rows = await getDb().select().from(teams);
    kitchenId = rows.find((t) => t.key === "kitchen")?.id ?? "";
    giftId = rows.find((t) => t.key === "gift_projects")?.id ?? "";
  });

  const post = async (endsInHours = 48, by = lead, teamId = kitchenId) =>
    postNotice(await as(by), {
      teamId,
      body: "Container loading Saturday 8am, bring gloves",
      endsAt: hours(endsInHours),
    });

  it("a lead posts to their team and members see it as a banner", async () => {
    const id = await post();
    const seen = await activeNoticesFor(getDb(), sam, T);
    expect(seen.map((n) => n.id)).toEqual([id]);
    expect(seen[0]).toMatchObject({ authorName: "Alex", teamName: "Kitchen" });
    expect(await activeNoticesFor(getDb(), outsider, T)).toEqual([]);
    expect(await activeNoticesFor(getDb(), lead, T)).toEqual([]);
  });

  it("disappears on its own when the end time passes", async () => {
    await post(2);
    expect(await activeNoticesFor(getDb(), sam, hours(1))).toHaveLength(1);
    expect(await activeNoticesFor(getDb(), sam, hours(2))).toEqual([]);
  });

  it("'Got it' hides it for that person only and the lead sees who read it, also after it ends", async () => {
    const id = await post(2);
    await markNoticeRead(await as(sam, hours(1)), id);
    await markNoticeRead(await as(sam, hours(1)), id);
    expect(await activeNoticesFor(getDb(), sam, hours(1))).toEqual([]);
    expect(await activeNoticesFor(getDb(), jo, hours(1))).toHaveLength(1);
    const [team] = await noticesForLead(await as(lead, hours(5)));
    const notice = team?.notices.find((n) => n.id === id);
    expect(notice?.ended).toBe(true);
    expect(notice?.readers.map((r) => [r.name, Boolean(r.readAt)])).toEqual([
      ["Jo", false],
      ["Sam", true],
    ]);
  });

  it("only a lead of that team (or an admin) can post", async () => {
    await expect(post(48, sam)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(post(48, lead, giftId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(post(48, admin, giftId)).resolves.toBeTruthy();
  });

  it("needs words and an end time in the future", async () => {
    await expect(post(-1)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      postNotice(await as(lead), { teamId: kitchenId, body: "  ", endsAt: hours(5) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("someone outside the team can't mark it read, and members can't see read lists", async () => {
    const id = await post();
    await expect(markNoticeRead(await as(outsider), id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await noticesForLead(await as(sam))).toEqual([]);
  });
});

describe("ending a team notice early", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    lead = await createPerson({
      email: "l@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    });
    sam = await createPerson({
      email: "s@example.test",
      name: "Sam",
      teams: [{ key: "kitchen", role: "member" }],
    });
    const rows = await getDb().select().from(teams);
    kitchenId = rows.find((t) => t.key === "kitchen")?.id ?? "";
  });

  const post = async () =>
    postNotice(await as(lead), { teamId: kitchenId, body: "Ice run Tuesday", endsAt: hours(48) });

  it("the lead ends it now: the banner goes for everyone and the read list stays", async () => {
    const id = await post();
    await endNoticeNow(await as(lead, hours(1)), id);
    expect(await activeNoticesFor(getDb(), sam, hours(1))).toEqual([]);
    const [team] = await noticesForLead(await as(lead, hours(2)));
    const notice = team?.notices.find((n) => n.id === id);
    expect(notice?.ended).toBe(true);
    expect(notice?.endsAt).toEqual(hours(1));
  });

  it("a member can't end it, and an ended notice can't be ended again", async () => {
    const id = await post();
    await expect(endNoticeNow(await as(sam, hours(1)), id)).rejects.toBeInstanceOf(ForbiddenError);
    await endNoticeNow(await as(lead, hours(1)), id);
    await expect(endNoticeNow(await as(lead, hours(3)), id)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
