// Server-rendered screens: what members vs managers get (docs/specs/obligations.md §5).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actorFor,
  addTeam,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { seed } from "../seed";
import { listObligations } from "../server/queries";
import { BoardPage } from "../ui/pages/board";
import { DetailPage } from "../ui/pages/detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let admin: string;
let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const idOf = async (key: string) =>
  (await listObligations(getDb(), EDITION.id)).find((r) => r.key === key)?.taskId ?? "";

describe("obligations pages", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    await addTeam("camp_infra");
    admin = await createPerson({ email: "a@example.test", name: "Admin A", roles: ["admin"] });
    const lead = await createPerson({ email: "l@example.test", name: "Lead L" });
    member = await createPerson({ email: "m@example.test", name: "Member M" });
    await seed({
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    });
  });

  it("members get the list with theirs on top, no summary or table", async () => {
    const html = renderToStaticMarkup(await BoardPage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Yours (2)");
    expect(html).toContain("All camp deadlines (6)");
    expect(html).toContain("TBC (2026: Apr 5)");
    expect(html).toContain("Late");
    expect(html).not.toContain('aria-label="Summary"');
    expect(html).not.toContain("<table");
  });

  it("managers also get the summary counts and the laptop table", async () => {
    const html = renderToStaticMarkup(await BoardPage({ ctx: await ctxFor(admin) }));
    expect(html).toContain('aria-label="Summary"');
    expect(html).toContain("<table");
    expect(html).toContain("1/6");
  });

  it("detail: the owner can submit, only managers see Edit, done ones show Reopen", async () => {
    const sound = await idOf("sound_plan");
    const asMember = renderToStaticMarkup(
      await DetailPage({ ctx: await ctxFor(member), taskId: sound }),
    );
    expect(asMember).toContain("Mark submitted");
    expect(asMember).not.toContain(">Edit<");
    expect(asMember).toContain("Art car stops and times");

    const mv = await idOf("mv_registration");
    const notMine = renderToStaticMarkup(
      await DetailPage({ ctx: await ctxFor(member), taskId: mv }),
    );
    expect(notMine).not.toContain("Mark submitted");
    expect(notMine).toContain("No owner yet");

    const done = await idOf("nominate_officers");
    const asAdmin = renderToStaticMarkup(
      await DetailPage({ ctx: await ctxFor(admin), taskId: done }),
    );
    expect(asAdmin).toContain(">Edit<");
    expect(asAdmin).toContain("Reopen");
    expect(asAdmin).not.toContain("Mark submitted");
  });

  it("detail 404s on a malformed or unknown id", async () => {
    const ctx = await ctxFor(member);
    await expect(DetailPage({ ctx, taskId: "nope" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      DetailPage({ ctx, taskId: "01900000-0000-7000-8000-00000000dead" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
