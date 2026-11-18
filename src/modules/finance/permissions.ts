import { type Actor, definePermissions } from "@/base/api";
import { canDecideStep, type StepResource } from "./rules/policy";

const live = (a: Actor) => a.isConfirmedMember && a.personId !== null;
/** Money powers (decision F3): finance approvers and camp leads. Admin alone is not one. */
const money = (a: Actor) => live(a) && (a.hasRole("finance_approver") || a.hasRole("camp_lead"));

export const financePermissions = definePermissions("finance", {
  /** Your own requests (members see no team or camp totals; see F2). */
  "finance.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Ask for money for a team you're on. */
  "finance.spend.request": (a: Actor, r?: unknown) => {
    const teamId = (r as { teamId?: string } | undefined)?.teamId;
    return live(a) && teamId !== undefined && a.isMemberOf(teamId);
  },
  /** One request's details: its requester, its team's leads, finance approvers, camp leads (F5). */
  "finance.spend.view": (a: Actor, r?: unknown) => {
    const x = r as { requesterId?: string; teamId?: string } | undefined;
    if (!x?.requesterId || !x.teamId || !live(a)) return false;
    return x.requesterId === a.personId || a.isLeadOf(x.teamId) || money(a);
  },
  /** Decide the current step (rules/policy.ts): never your own request. */
  "finance.spend.approve": (a: Actor, r?: unknown) =>
    r !== undefined && canDecideStep(a, r as StepResource),
  /** Lead views: team leads (their teams), finance approvers and camp leads (everything, CSV). */
  "finance.report.view": (a: Actor) => live(a) && (a.isAnyTeamLead || money(a)),
  /** Camp fees (applicants spec §6): see them and record a payment. Never your own fee. */
  "finance.fees.manage": (a: Actor, r?: unknown) => {
    const personId = (r as { personId?: string | null } | undefined)?.personId;
    return money(a) && (r === undefined || (personId != null && personId !== a.personId));
  },
  /** Budgets and pay-backs. Never your own pay-back. */
  "finance.manage": (a: Actor, r?: unknown) => {
    const payeeId = (r as { payeeId?: string } | undefined)?.payeeId;
    return money(a) && payeeId !== a.personId;
  },
});
