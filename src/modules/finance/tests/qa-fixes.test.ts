// Money QA fixes (click-through, 21 Oct 2026): clear form messages, no pre-picked "no" reason,
// budget card wording.
import { describe, expect, it } from "vitest";
import { budgetLine } from "../rules/budget-line";
import { defaultReason } from "../rules/decision-reasons";
import { checkRequestForm, LIMITS } from "../rules/request-form";

const ok = { title: "Gas bottles", amount: "4500", why: "", supplier: "" };

describe("request form check (before anything is sent)", () => {
  it("a good form has no problems", () => {
    expect(checkRequestForm(ok)).toEqual({});
  });
  it("blank form: a message on each required field", () => {
    expect(checkRequestForm({ title: "", amount: "", why: "", supplier: "" })).toEqual({
      title: "Say what you need (at least 3 letters).",
      amount: "Enter an amount, like 4500 or $4,500.50.",
    });
  });
  it("negative, zero, letters and huge amounts get a field message, not a crash", () => {
    for (const amount of ["-50", "0", "abc", "12x", "99999999"])
      expect(checkRequestForm({ ...ok, amount }).amount).toMatch(/amount/i);
    expect(checkRequestForm({ ...ok, amount: "-50" }).amount).toBe(
      "The amount must be more than zero.",
    );
  });
  it("too-long text says the limit instead of being cut silently", () => {
    expect(LIMITS).toEqual({ title: 120, why: 2000, supplier: 120 });
    expect(checkRequestForm({ ...ok, title: "x".repeat(121) }).title).toBe(
      "Keep it to 120 characters (now 121).",
    );
    expect(checkRequestForm({ ...ok, why: "x".repeat(2001) }).why).toBe(
      "Keep it to 2000 characters (now 2001).",
    );
  });
});

describe("decision reasons", () => {
  it("approve keeps its quick default; ask for info and turn down make you pick", () => {
    expect(defaultReason("approved")).toBe("within_budget");
    expect(defaultReason("needs_info")).toBeNull();
    expect(defaultReason("rejected")).toBeNull();
  });
});

describe("budget card line", () => {
  it("says the total budget as the total, and 'left' only next to what's left", () => {
    expect(
      budgetLine({ actualCents: 150_000, committedCents: 119_050, budgetCents: 6_000_000 }),
    ).toBe("$1,500 spent · $1,190.50 approved, not bought · of a $60,000 budget");
  });
});
