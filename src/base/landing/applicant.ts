import type { Actor } from "../authz/actor";

/** Where applicants live (the applicants module route, spec applicants §1). */
export const APPLICANT_HOME = "/apply";

/**
 * Where a signed-in person lands after sign-in (spec applicants §1): applicants on the applicant
 * home; joined members, leads and admins on the home page, which shows each its own layout.
 */
export function homeFor(actor: Actor): string {
  return actor.isApplicant ? APPLICANT_HOME : "/";
}

/** Base screens are for members: an applicant asking for one is sent to the applicant home. */
export function applicantRedirectTarget(actor: Actor): string | null {
  return actor.isApplicant ? APPLICANT_HOME : null;
}
