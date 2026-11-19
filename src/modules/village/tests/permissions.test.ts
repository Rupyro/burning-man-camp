import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "village.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "village.manage": {
    allow: ["team_lead", "camp_lead", "admin"],
    deny: ["member", "finance_approver", "waitlisted"],
  },
});

describe("village_liaison", () => {
  it("manages when confirmed for the year, not otherwise", () => {
    expect(can(persona("member", { roles: ["village_liaison"] }), "village.manage")).toBe(true);
    expect(can(persona("waitlisted", { roles: ["village_liaison"] }), "village.manage")).toBe(
      false,
    );
  });
});
