// The About text and finance-policy wording moved into camp-content/ must stay
// byte-identical for the Burning Man starter camp.
import { describe, expect, it } from "vitest";
import { ABOUT_BANNER, ABOUT_BLOCKS } from "../../camp-content/about";
import { PLACEHOLDER_POLICIES } from "../../camp-content/policies";
import { CAMP_NAME, MONEY_SYMBOL } from "../../src/lib/camp";
import { PLACEHOLDER_POLICIES as fromRules } from "../../src/modules/finance/rules/policy";

describe("camp-content About and policy wording (starter camp)", () => {
  it("the About banner and blocks are unchanged", () => {
    expect(ABOUT_BANNER).toBe("Dust, shade, music and good people.");
    expect(
      ABOUT_BLOCKS.map((b) => ({
        title: b.title,
        body: b.body,
        pack: "pack" in b ? b.pack : undefined,
      })),
    ).toEqual([
      {
        title: "Who we are",
        body: `${CAMP_NAME} is a theme camp at Burning Man in Black Rock City, Nevada: about 70 people who build a shady, friendly home on the playa and share it with everyone who walks past.`,
        pack: undefined,
      },
      {
        title: "The art car",
        body: "Our roaming art car carries the music. It parks at a sunset link-up with another camp and at a night spot, then comes home. Crew, DJs and decorators all have a place on it.",
        pack: "mutant-vehicle",
      },
      {
        title: "How we work",
        body: "Everyone builds, everyone takes shifts, everyone helps strike and leave no trace. In return: a kitchen that feeds you, a quiet zone to sleep in, and a crew that has your back.",
        pack: undefined,
      },
    ]);
  });

  it("the placeholder policy names, limits and steps are unchanged", () => {
    expect(PLACEHOLDER_POLICIES).toBe(fromRules);
    expect(PLACEHOLDER_POLICIES.map((p) => ({ ...p }))).toEqual([
      {
        name: "Small, within budget",
        minCents: 0,
        maxCents: 150_000,
        withinBudgetOnly: true,
        requiredSteps: [{ approver: "team_lead" }],
        sortOrder: 1,
        isActive: true,
      },
      {
        name: `Up to ${MONEY_SYMBOL}10,000, within budget`,
        minCents: 0,
        maxCents: 1_000_000,
        withinBudgetOnly: true,
        requiredSteps: [{ approver: "role:finance_approver" }],
        sortOrder: 2,
        isActive: true,
      },
      {
        name: "Large or over budget",
        minCents: 0,
        maxCents: null,
        withinBudgetOnly: false,
        requiredSteps: [{ approver: "role:finance_approver" }, { approver: "role:camp_lead" }],
        sortOrder: 3,
        isActive: true,
      },
    ]);
    expect(PLACEHOLDER_POLICIES[1]?.name).toBe("Up to $10,000, within budget");
  });
});
