import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { HomePage } from "./pages/home";
import { PackPage } from "./pages/pack";
import { ShiftPage } from "./pages/shift";

async function ShiftsRouter({ ctx, slug }: ModulePageProps) {
  const [page, id, ...rest] = slug;
  if (rest.length) notFound();
  try {
    await requireCapability(ctx, "shifts.view");
    if (!page) return await HomePage({ ctx });
    if (page === "pack" && !id) return await PackPage({ ctx });
    if (page === "s" && id) return await ShiftPage({ ctx, id });
    notFound();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("shifts", ShiftsRouter);
