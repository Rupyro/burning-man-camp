import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { BoardPage } from "./pages/board";
import { DetailPage } from "./pages/detail";
import { QuizPage } from "./pages/quiz";

async function ObligationsRouter({ ctx, slug }: ModulePageProps) {
  const [page, ...rest] = slug;
  if (rest.length) notFound();
  try {
    await requireCapability(ctx, "obligations.view");
    if (!page) return await BoardPage({ ctx });
    if (page === "quiz") return await QuizPage({ ctx });
    return await DetailPage({ ctx, taskId: page });
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("obligations", ObligationsRouter);
