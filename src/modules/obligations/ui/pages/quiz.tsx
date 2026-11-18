import type { ModuleContext } from "@/base/api";
import { Emblem } from "@/lib/emblem";
import { LNT_QUIZ } from "../../rules/quiz";
import { hasPassedQuiz } from "../../server/quiz";
import { QuizForm } from "../components/quiz-form";

export async function QuizPage({ ctx }: { ctx: ModuleContext }) {
  const personId = ctx.actor.personId;
  const passed = personId ? await hasPassedQuiz(ctx.db, ctx.edition.id, personId) : false;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Leave no trace and generator safety</h1>
      {passed ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
          <Emblem stage={4} head className="size-28" label="Leave no trace badge" />
          <p className="text-lg font-medium">You passed. Nice one!</p>
          <p className="text-sm">
            Your leave no trace badge is earned for this year. Thanks for looking after the reserve
            and keeping camp safe.
          </p>
        </section>
      ) : (
        <>
          <p className="text-sm">
            {LNT_QUIZ.length} quick questions from AfrikaBurn's leave no trace and generator guides.
            Get them all right to earn your badge. You can try as often as you like.
          </p>
          <QuizForm />
        </>
      )}
    </main>
  );
}
