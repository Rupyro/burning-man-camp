// The quiz screen and its pass record (one per person per edition).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { LNT_QUIZ } from "../rules/quiz";
import { hasPassedQuiz, recordQuizPass } from "../server/quiz";
import { QuizPage } from "../ui/pages/quiz";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

let member: string;
const ctxFor = async (personId: string) => ({
  actor: await actorFor(personId),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const right = LNT_QUIZ.map((q) => q.answer);

describe("quiz pages", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    member = await createPerson({ email: "m@example.test", name: "Member M" });
  });

  it("shows the questions until you pass", async () => {
    const html = renderToStaticMarkup(await QuizPage({ ctx: await ctxFor(member) }));
    expect(html).toContain("Leave no trace and generator safety");
    expect(html).toContain(LNT_QUIZ[0]?.q ?? "missing");
    expect(html).not.toContain("You passed");
  });

  it("records a pass once, only for all-right answers, then shows the badge", async () => {
    const db = getDb();
    const rec = (a: number[]) => db.transaction((tx) => recordQuizPass(tx, EDITION.id, member, a));
    expect(await rec(right.map((a, i) => (i ? a : a + 1)))).toBe(false);
    expect(await hasPassedQuiz(db, EDITION.id, member)).toBe(false);
    expect(await rec(right)).toBe(true);
    expect(await rec(right)).toBe(true);
    expect(await hasPassedQuiz(db, EDITION.id, member)).toBe(true);
    const html = renderToStaticMarkup(await QuizPage({ ctx: await ctxFor(member) }));
    expect(html).toContain("You passed");
    expect(html).toContain("Leave no trace badge");
  });
});
