import "server-only";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/base/db/client";
import { ForbiddenError } from "@/base/errors";
import { getRequestContext } from "@/base/guard/request";
import { applicantRedirectTarget } from "@/base/landing/applicant";
import type { PeopleCtx } from "@/base/people/directory";
import { ensureRegistry } from "../../boot";

/**
 * Base screens: resolve the caller on the server; Forbidden becomes a 404 (no hint it exists).
 * Applicants are sent to the applicant home (spec applicants §7).
 */
export async function basePage<T>(
  load: (ctx: PeopleCtx & { db: ReturnType<typeof getDb> }) => Promise<T>,
) {
  ensureRegistry();
  const rc = await getRequestContext();
  if (!rc) redirect("/login");
  const applicant = applicantRedirectTarget(rc.actor);
  if (applicant) redirect(applicant);
  try {
    return await load({ db: getDb(), actor: rc.actor, edition: rc.edition });
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}
