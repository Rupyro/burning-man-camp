"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { gradeQuiz, LNT_QUIZ } from "../../rules/quiz";
import { submitQuiz } from "../../server/quiz-actions";

export function QuizForm() {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState<number[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = LNT_QUIZ.every((_, i) => answers[i] !== undefined);

  const check = () => {
    const r = gradeQuiz(answers);
    setChecked(r.wrong);
    if (!r.passed) {
      setMsg(`${r.right} of ${r.total} right. Have another look at the ones marked below.`);
      return;
    }
    setMsg(null);
    start(async () => {
      try {
        const res = await submitQuiz({ answers });
        if (isActionFailure(res)) setMsg(res.error);
        else router.refresh();
      } catch {
        setMsg("That didn't save. Please try again.");
      }
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      {LNT_QUIZ.map((q, i) => (
        <fieldset key={q.q} className="rounded-2xl border bg-card p-3">
          <legend className="px-1 font-medium">
            {i + 1}. {q.q}
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {q.choices.map((c, j) => (
              <label key={c} className="flex min-h-11 items-center gap-2 rounded-lg border p-2">
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === j}
                  onChange={() => {
                    const next = [...answers];
                    next[i] = j;
                    setAnswers(next);
                  }}
                />
                {c}
              </label>
            ))}
          </div>
          {checked?.includes(i) ? <p className="mt-2 text-sm">Not quite. {q.why}</p> : null}
        </fieldset>
      ))}
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
      <Button type="submit" disabled={!done || pending}>
        {pending ? "Saving…" : "Check my answers"}
      </Button>
    </form>
  );
}
