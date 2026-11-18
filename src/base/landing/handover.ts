// A module's handovers as Up next items for the person looking (automation plan, "Every
// handover looks the same"). They're computed from live data, so each closes itself once solved.
import type { Actor } from "../authz/actor";
import { handoverHeadline } from "../engine/rules/reminders";
import type { HandoverCandidate, ModuleId, MyItem } from "../registry/types";

export function isHandoverFor(actor: Actor, h: HandoverCandidate): boolean {
  if (!actor.personId) return false;
  if ("personIds" in h.to) return h.to.personIds.includes(actor.personId);
  if ("teamId" in h.to) return actor.isLeadOf(h.to.teamId);
  return actor.hasRole(h.to.role);
}

/** The handovers meant for this person, as queue rows: title = what + who, reason = why. */
export function handoverItems(
  moduleId: ModuleId,
  actor: Actor,
  handovers: readonly HandoverCandidate[],
): MyItem[] {
  return handovers
    .filter((h) => isHandoverFor(actor, h))
    .map((h) => ({
      id: `${h.rule}:${h.entityId}:handover`,
      moduleId,
      kind: "handover" as const,
      title: handoverHeadline(h),
      reason: h.why,
      urgency: "soon" as const,
      href: h.href,
    }));
}
