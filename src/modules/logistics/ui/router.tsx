import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { RidesBoardPage } from "./pages/board";
import { HomePage } from "./pages/home";
import { LoadPage } from "./pages/load";

async function LogisticsRouter({ ctx, slug, searchParams }: ModulePageProps) {
  const [page, id, ...rest] = slug;
  if (rest.length) notFound();
  try {
    await requireCapability(ctx, "logistics.view");
    if (!page) return await HomePage({ ctx });
    if (page === "l" && id) return await LoadPage({ ctx, id });
    if (page === "rides" && !id)
      return await RidesBoardPage({ ctx, back: searchParams.back === "1" });
    notFound();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("logistics", LogisticsRouter);
