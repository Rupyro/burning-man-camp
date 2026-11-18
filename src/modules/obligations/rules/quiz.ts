/**
 * Leave-no-trace and generator safety quiz. Facts from AfrikaBurn's Theme Camp LNT
 * Infopack 2025 and Generator Infopack 2025.
 */
export const QUIZ_KEY = "lnt_generator";

export type QuizQuestion = { q: string; choices: string[]; answer: number; why: string };

export const LNT_QUIZ: QuizQuestion[] = [
  {
    q: "Camp is packed up. What happens to everything we brought?",
    choices: [
      "We leave it for the clean-up crew",
      "We take it all home with us",
      "We burn what's left",
    ],
    answer: 1,
    why: "What you bring to AfrikaBurn, you take home. There are no bins out there.",
  },
  {
    q: "You spot a sequin and a cut-off cable tie in the dust. Do they count?",
    choices: ["Yes, pick them up, small bits are MOOP too", "No, they're too small to matter"],
    answer: 0,
    why: "Micro-MOOP counts. Small pieces are the easiest to miss and the hardest on the reserve.",
  },
  {
    q: "Where does the generator fuel live?",
    choices: [
      "In any old bottle, in the shade",
      "In an approved metal or HDPE container, inside a bund",
      "Next to the generator, so it's handy",
    ],
    answer: 1,
    why: "Fuel goes in approved, labelled containers, kept in a bund, away from heat and flames.",
  },
  {
    q: "The generator is running and nearly empty. What do you do?",
    choices: ["Top it up quickly while it runs", "Switch it off, let it cool, then refuel"],
    answer: 1,
    why: "Never refuel a hot or running generator. Spilled fuel on a hot engine can catch fire.",
  },
  {
    q: "How should the power cables run through camp?",
    choices: ["Laid safely, so nobody trips over them", "However they reach, we'll step over them"],
    answer: 0,
    why: "Cables and leads are a trip hazard, especially at night. Lay them safely.",
  },
];

export type QuizResult = { right: number; total: number; passed: boolean; wrong: number[] };

/** You pass with every answer right; you can try again as often as you like. */
export function gradeQuiz(answers: readonly number[]): QuizResult {
  const wrong = LNT_QUIZ.flatMap((q, i) => (answers[i] === q.answer ? [] : [i]));
  const total = LNT_QUIZ.length;
  return { right: total - wrong.length, total, passed: wrong.length === 0, wrong };
}
