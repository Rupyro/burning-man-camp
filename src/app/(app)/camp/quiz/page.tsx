import Link from "next/link";
import { EVENT, EVENT_NAME } from "@/lib/event";
import { gradeQuiz } from "@/lib/first-timer-quiz";
import { basePage } from "../../_components/base-page";

/** First-timer quiz (plan Phase 4): the event's basics, graded on submit, with sources. */
export default async function QuizPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await basePage(async () => null);
  const q = await props.searchParams;
  const quiz = EVENT.quiz ?? [];
  const submitted = q.done === "1";
  const result = gradeQuiz(quiz, q);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">First-timer quiz</h1>
        <p className="text-sm text-muted-foreground">
          {quiz.length} quick questions on {EVENT_NAME}'s basics. Nothing is saved.
        </p>
      </div>
      {submitted ? (
        <p role="status" className="rounded-2xl border bg-card p-4 text-sm font-semibold">
          {result.correct} of {result.total} right.{" "}
          {result.correct === result.total
            ? "You're ready."
            : "Read the linked pages for the ones you missed."}
        </p>
      ) : null}
      {quiz.length ? (
        <form method="get" className="flex flex-col gap-3">
          {quiz.map((item, i) => {
            const mark = result.marks[i];
            return (
              <fieldset key={item.key} className="rounded-2xl border bg-card p-4">
                <legend className="px-1 text-sm font-semibold">{item.question}</legend>
                {item.options.map((o, j) => (
                  <label key={o} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={item.key}
                      value={j}
                      defaultChecked={mark?.chosen === j}
                    />
                    {o}
                  </label>
                ))}
                {submitted ? (
                  <p className="text-sm">
                    {mark?.right ? "Right." : `Answer: ${item.options[item.answer]}.`}{" "}
                    <a href={item.source} className="underline" target="_blank" rel="noreferrer">
                      Source
                    </a>
                  </p>
                ) : null}
              </fieldset>
            );
          })}
          <input type="hidden" name="done" value="1" />
          <button type="submit" className="min-h-11 rounded-lg border font-semibold">
            Check my answers
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">No quiz for this event yet.</p>
      )}
      <Link href="/camp" className="text-sm underline">
        Back to camp info
      </Link>
    </div>
  );
}
