import { notFound } from "next/navigation";
import {
  ForbiddenError,
  guardModulePage,
  type ModulePageProps,
  requireCapability,
} from "@/base/api";
import { HomePage } from "./pages/home";

async function ExodusRouter({ ctx, slug }: ModulePageProps) {
  if (slug.length) notFound();
  try {
    await requireCapability(ctx, "exodus.view");
    return await HomePage({ ctx });
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}

export default guardModulePage("exodus", ExodusRouter);
