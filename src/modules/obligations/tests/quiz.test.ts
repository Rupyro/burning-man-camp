import { describe, expect, it } from "vitest";
import { gradeQuiz, LNT_QUIZ, QUIZ_KEY } from "../rules/quiz";

const right = LNT_QUIZ.map((q) => q.answer);

describe("leave-no-trace quiz", () => {
  it("has five questions, each with one right answer among its choices", () => {
    expect(QUIZ_KEY).toBe("lnt_generator");
    expect(LNT_QUIZ).toHaveLength(5);
    for (const q of LNT_QUIZ) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(q.why.length).toBeGreaterThan(10);
    }
  });

  it("passes only when every answer is right", () => {
    expect(gradeQuiz(right)).toEqual({ right: 5, total: 5, passed: true, wrong: [] });
    const one = [...right];
    one[2] = ((one[2] ?? 0) + 1) % (LNT_QUIZ[2]?.choices.length ?? 1);
    expect(gradeQuiz(one)).toEqual({ right: 4, total: 5, passed: false, wrong: [2] });
  });

  it("treats missing or out-of-range answers as wrong", () => {
    expect(gradeQuiz([]).wrong).toEqual([0, 1, 2, 3, 4]);
    expect(gradeQuiz([99, ...right.slice(1)]).passed).toBe(false);
  });
});
