import { afterEach, describe, expect, it } from "vitest";
import { demoFlagOn, PERSONAS } from "@/base/demo/personas";

const saved = process.env.DEMO_MODE;
afterEach(() => {
  if (saved === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = saved;
});

describe("demo mode flag (spec B3-demo §1)", () => {
  it("is off by default and only exactly 'true' turns it on", () => {
    delete process.env.DEMO_MODE;
    expect(demoFlagOn()).toBe(false);
    for (const v of ["", "1", "yes", "TRUE ", "false"]) {
      process.env.DEMO_MODE = v;
      expect(demoFlagOn()).toBe(false);
    }
    process.env.DEMO_MODE = "true";
    expect(demoFlagOn()).toBe(true);
  });

  // Seven since the New applicant persona, shown first (Sage, 21 Oct 2026).
  it("offers seven fake personas, New applicant first, all on the example.test domain", () => {
    expect(PERSONAS.map((p) => p.key)).toEqual([
      "new_applicant",
      "member",
      "kitchen_lead",
      "diet_viewer",
      "finance_approver",
      "applicant",
      "admin",
    ]);
    for (const p of PERSONAS) expect(p.email).toMatch(/@example\.test$/);
    expect(PERSONAS[0]?.label).toBe("New applicant");
  });
});
