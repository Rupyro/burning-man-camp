// Every shifts capability, allow and deny, plus the Duties-lead case.
import { describe, expect, it } from "vitest";
import { can } from "@/base/api";
import { permissionMatrix, persona } from "@/base/api/testing";
import { manifest } from "../manifest";

const DUTIES = "01900000-0000-7000-8000-00000000d0d0";
const onDuties = (role: "lead" | "member") =>
  persona("member", { teams: [{ teamId: DUTIES, teamKey: "duties", role }] });

permissionMatrix(manifest, {
  "shifts.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "shifts.claim": {
    allow: ["member", "team_lead", "camp_lead"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "shifts.manage": {
    allow: ["camp_lead"],
    deny: ["member", "team_lead", "admin", "waitlisted"],
  },
});

describe("duties team", () => {
  it("a Duties lead manages shifts; a Duties member doesn't", () => {
    expect(can(onDuties("lead"), "shifts.manage")).toBe(true);
    expect(can(onDuties("member"), "shifts.manage")).toBe(false);
  });
});
