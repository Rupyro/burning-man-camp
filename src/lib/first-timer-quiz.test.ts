import { describe, expect, it } from "vitest";
import { EVENT_PACKS } from "../../camp-events";
import { gradeQuiz, quizProblems } from "./first-timer-quiz";

const quiz = [
  { key: "a", question: "A?", options: ["x", "y"], answer: 1, source: "https://example.test" },
  { key: "b", question: "B?", options: ["x", "y", "z"], answer: 0, source: "https://example.test" },
];

describe("gradeQuiz", () => {
  it("marks right, wrong and unanswered", () => {
    const r = gradeQuiz(quiz, { a: "1", b: "2" });
    expect(r).toMatchObject({ answered: 2, correct: 1, total: 2 });
    expect(r.marks).toEqual([
      { key: "a", chosen: 1, right: true },
      { key: "b", chosen: 2, right: false },
    ]);
    expect(gradeQuiz(quiz, {}).answered).toBe(0);
  });
  it("ignores junk and out-of-range answers", () => {
    const r = gradeQuiz(quiz, { a: "7", b: "x" });
    expect(r.marks.map((m) => m.chosen)).toEqual([null, null]);
    expect(gradeQuiz(quiz, { a: "" }).marks[0]?.chosen).toBeNull();
  });
});

describe("quizProblems", () => {
  it("flags duplicate keys, too few options and bad answers", () => {
    expect(quizProblems([quiz[0]!, { ...quiz[0]!, options: ["only"], answer: 3 }])).toEqual([
      "a: duplicate key",
      "a: needs at least two options",
      "a: answer out of range",
    ]);
  });
  it("finds nothing wrong in the event packs' quizzes, and every source is https", () => {
    for (const pack of Object.values(EVENT_PACKS)) {
      const q = pack.quiz ?? [];
      expect(quizProblems(q)).toEqual([]);
      for (const item of q) expect(item.source).toMatch(/^https:\/\//);
    }
  });
});
