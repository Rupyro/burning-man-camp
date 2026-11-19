// First-timer quiz (plan Phase 4): a few questions from the event's own rules, so a new member
// knows the basics before arriving. Questions live in the event pack; grading is pure.

export interface QuizQuestion {
  key: string;
  question: string;
  options: readonly string[];
  /** Index into `options`. */
  answer: number;
  /** Where the answer comes from. */
  source: string;
}

export interface QuizResult {
  answered: number;
  correct: number;
  total: number;
  /** Per question: the chosen option index (or null), and whether it's right. */
  marks: { key: string; chosen: number | null; right: boolean }[];
}

/** Grade answers given as option indexes in a query (e.g. { water: "1" }). */
export function gradeQuiz(
  quiz: readonly QuizQuestion[],
  answers: Record<string, string | undefined>,
): QuizResult {
  const marks = quiz.map((q) => {
    const raw = answers[q.key];
    const n = raw === undefined || raw === "" ? Number.NaN : Number(raw);
    const chosen = Number.isInteger(n) && n >= 0 && n < q.options.length ? n : null;
    return { key: q.key, chosen, right: chosen === q.answer };
  });
  return {
    answered: marks.filter((m) => m.chosen !== null).length,
    correct: marks.filter((m) => m.right).length,
    total: quiz.length,
    marks,
  };
}

/** Problems with a quiz definition (answer out of range, duplicate keys), for the pack test. */
export function quizProblems(quiz: readonly QuizQuestion[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const q of quiz) {
    if (seen.has(q.key)) out.push(`${q.key}: duplicate key`);
    seen.add(q.key);
    if (q.options.length < 2) out.push(`${q.key}: needs at least two options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      out.push(`${q.key}: answer out of range`);
  }
  return out;
}
