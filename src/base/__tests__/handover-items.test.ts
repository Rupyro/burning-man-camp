// Handovers as Up next rows, only for the people they're meant for.
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { handoverItems } from "@/base/landing/handover";
import type { HandoverCandidate } from "@/contracts/automations";

const h = (to: HandoverCandidate["to"]): HandoverCandidate => ({
  rule: "finance.receipt_missing",
  entityType: "finance.expense",
  entityId: "e1",
  to,
  what: "No receipt: R100",
  about: "Sam",
  why: "3 reminders, no receipt",
  href: "/finance/r/1",
});

describe("handoverItems", () => {
  it("goes to the role, the team's leads, or the named people only", () => {
    const camp = persona("camp_lead");
    const member = persona("member");
    expect(handoverItems("finance", camp, [h({ role: "camp_lead" })])).toEqual([
      {
        id: "finance.receipt_missing:e1:handover",
        moduleId: "finance",
        kind: "handover",
        title: "No receipt: R100: Sam",
        reason: "3 reminders, no receipt",
        urgency: "soon",
        href: "/finance/r/1",
      },
    ]);
    expect(handoverItems("finance", member, [h({ role: "camp_lead" })])).toEqual([]);
    expect(
      handoverItems("finance", member, [h({ personIds: [member.personId ?? ""] })]),
    ).toHaveLength(1);
    const lead = persona("team_lead");
    const team = lead.teams[0]?.teamId ?? "none";
    expect(handoverItems("finance", lead, [h({ teamId: team })])).toHaveLength(1);
    expect(handoverItems("finance", member, [h({ teamId: team })])).toEqual([]);
    expect(
      handoverItems("finance", persona("member", { personId: null }), [h({ role: "camp_lead" })]),
    ).toEqual([]);
  });
});
