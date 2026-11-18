import { type Actor, definePermissions } from "@/base/api";

/** Leads and admins review applications (spec applicants §5). Never an applicant themselves. */
const reviewer = (a: Actor) =>
  a.personId !== null &&
  !a.isApplicant &&
  (a.isAdmin || (a.isConfirmedMember && (a.hasRole("camp_lead") || a.isAnyTeamLead)));

const ownerOf = (r: unknown) => (r as { personId?: string } | undefined)?.personId;

export const applicantsPermissions = definePermissions("applicants", {
  /** Applicants: their home, form and documents. With a record, only their own. */
  "applicants.apply": (a: Actor, r?: unknown) => {
    if (!a.isApplicant || a.personId === null) return false;
    return r === undefined || ownerOf(r) === a.personId;
  },
  /** New members: tick "I've read the camp guide" on their own welcome list. */
  "applicants.welcome": (a: Actor) => a.personId !== null && a.isConfirmedMember,
  /** Open applications: the list and each application's details. */
  "applicants.review": (a: Actor) => reviewer(a),
  /** Change status, interview date or the lead note. Never on your own application. */
  "applicants.decide": (a: Actor, r?: unknown) => {
    const owner = ownerOf(r);
    return reviewer(a) && owner !== undefined && owner !== a.personId;
  },
});
