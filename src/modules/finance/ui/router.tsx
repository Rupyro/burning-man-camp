import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { DetailPage } from "./pages/detail";
import { FeesPage } from "./pages/fees";
import { HomePage } from "./pages/home";
import { NewRequestPage } from "./pages/new";

async function FinanceRouter({ ctx, slug }: ModulePageProps) {
  const [page, id, ...rest] = slug;
  if (rest.length) notFound();
  try {
    await requireCapability(ctx, "finance.view");
    if (!page) return await HomePage({ ctx });
    if (page === "new" && !id) return await NewRequestPage({ ctx });
    if (page === "r" && id) return await DetailPage({ ctx, id });
    if (page === "fees" && !id) {
      await requireCapability(ctx, "finance.fees.manage");
      return await FeesPage({ ctx });
    }
    notFound();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("finance", FinanceRouter);
