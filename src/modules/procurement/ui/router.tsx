import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { AskPage } from "./pages/ask";
import { DraftsPage } from "./pages/drafts";
import { HomePage } from "./pages/home";
import { ItemPage } from "./pages/item";
import { ListPage } from "./pages/list";
import { NeedPage } from "./pages/need";
import { NewNeedPage } from "./pages/new";
import { ReviewPage } from "./pages/review";

async function ProcurementRouter({ ctx, slug, searchParams }: ModulePageProps) {
  const [page, id, ...rest] = slug;
  if (rest.length) notFound();
  try {
    await requireCapability(ctx, "procurement.view");
    const q = typeof searchParams.q === "string" ? searchParams.q.slice(0, 80) : "";
    const one = (k: string) =>
      typeof searchParams[k] === "string" ? String(searchParams[k]) : undefined;
    if (!page)
      return await HomePage({
        ctx,
        q,
        view: {
          team: one("team"),
          status: one("status"),
          sort: one("sort"),
          all: one("all") === "1",
        },
      });
    if (page === "new" && !id) {
      const item = typeof searchParams.item === "string" ? searchParams.item : undefined;
      return await NewNeedPage({ ctx, itemId: item });
    }
    if (page === "ask" && !id) return await AskPage({ ctx });
    if (page === "drafts" && !id) return await DraftsPage({ ctx });
    if (page === "review" && !id) return await ReviewPage({ ctx });
    if (page === "i" && id) return await ItemPage({ ctx, id });
    if (page === "n" && id) return await NeedPage({ ctx, id });
    if (page === "list" && id) return await ListPage({ ctx, teamId: id });
    notFound();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("procurement", ProcurementRouter);
