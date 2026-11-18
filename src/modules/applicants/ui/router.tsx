import { notFound, redirect } from "next/navigation";
import {
  can,
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { DetailPage } from "./pages/detail";
import { FamilyDetailPage, FamilyJourneyPage, FamilyQueuePage } from "./pages/family";
import { FormPage } from "./pages/form";
import { ApplicantHome } from "./pages/home";
import { ReviewPage } from "./pages/review";
import { WelcomePage } from "./pages/welcome";

/**
 * /apply: applicants get their home and form; reviewers get Open applications. Each page checks
 * its own capability, so an applicant asking for a review URL gets a 404 (spec §7).
 */
async function ApplicantsRouter({ ctx, slug, searchParams }: ModulePageProps) {
  const [page, id, ...rest] = slug;
  if (rest.length) notFound();
  const param = (k: string) => (typeof searchParams[k] === "string" ? searchParams[k] : undefined);
  try {
    if (!page) {
      if (can(ctx.actor, "applicants.apply"))
        return await ApplicantHome({ ctx, sent: param("sent") === "1" });
      await requireCapability(ctx, "applicants.review");
      redirect("/apply/review");
    }
    if (page === "form" && !id) {
      await requireCapability(ctx, "applicants.apply");
      return await FormPage({ ctx });
    }
    if (page === "welcome" && !id) {
      await requireCapability(ctx, "applicants.welcome");
      return await WelcomePage({ ctx });
    }
    if (page === "journey" && !id) {
      await requireCapability(ctx, "applicants.apply");
      return await FamilyJourneyPage({ ctx });
    }
    if (page === "family") {
      await requireCapability(ctx, "applicants.review");
      return id ? await FamilyDetailPage({ ctx, id }) : await FamilyQueuePage({ ctx });
    }
    if (page === "review") {
      await requireCapability(ctx, "applicants.review");
      return id ? await DetailPage({ ctx, id }) : await ReviewPage({ ctx, stage: param("stage") });
    }
    notFound();
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("applicants", ApplicantsRouter);
