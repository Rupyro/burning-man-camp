import { and, eq } from "drizzle-orm";
import type { ActionContext, ReadOnlyDb } from "@/base/api";
import { gradeQuiz, QUIZ_KEY } from "../rules/quiz";
import { obligationQuizPasses as p } from "../schema";

export async function hasPassedQuiz(db: ReadOnlyDb, editionId: string, personId: string) {
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.editionId, editionId), eq(p.personId, personId), eq(p.quizKey, QUIZ_KEY)))
    .limit(1);
  return rows.length > 0;
}

/** Grades on the server; stores a pass only when every answer is right. Returns passed. */
export async function recordQuizPass(
  db: ActionContext["tx"],
  editionId: string,
  personId: string,
  answers: readonly number[],
) {
  if (!gradeQuiz(answers).passed) return false;
  await db.insert(p).values({ editionId, personId, quizKey: QUIZ_KEY }).onConflictDoNothing();
  return true;
}
