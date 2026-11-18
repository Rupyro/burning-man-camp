import { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { demoFlagOn } from "../demo/personas";
import { getCurrentEdition } from "../editions/current";
import { findPersonByEmail, normaliseEmail } from "./eligibility";
import { createInvite } from "./invites";

export type SignUpOutcome = "created" | "exists" | "demo" | "closed";

/**
 * Sign up to apply (spec applicants §1): a new email becomes a prospect for the current edition
 * with a live invite, so the normal login link works and the applicant lands on /apply. A known
 * email changes nothing (the caller answers the same way either way). The demo never writes:
 * a real email would switch demo mode off, so the demo points at the Applicant persona instead.
 */
export async function signUpApplicant(
  db: DbOrTx,
  input: { name: string; email: string },
  now = new Date(),
): Promise<SignUpOutcome> {
  if (demoFlagOn()) return "demo";
  const edition = await getCurrentEdition(db);
  if (!edition) return "closed";
  const email = normaliseEmail(input.email);
  if (await findPersonByEmail(db, email)) return "exists";
  await createInvite(db, {
    email,
    displayName: input.name.trim(),
    editionId: edition.id,
    invitedBy: Actor.system(edition.id),
    now,
    sendEmail: false,
    status: "prospect",
  });
  return "created";
}
