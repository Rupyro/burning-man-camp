// Camp info page helpers (docs/specs/b3-home-up-next.md §4).
import { describe, expect, it } from "vitest";
import { CAMP_GUIDE, leadContacts } from "@/base/landing/camp-info";
import type { DirectoryEntry } from "@/base/people/directory";

const entry = (personId: string, name: string, teams: DirectoryEntry["teams"]): DirectoryEntry => ({
  personId,
  displayName: name,
  playaName: null,
  countryCode: null,
  teams,
  skills: [],
  contact: { email: `${personId}@example.test`, phone: "+27000000000" },
  status: null,
});
const team = (name: string, role: "lead" | "co_lead" | "member") => ({
  id: name,
  key: name.toLowerCase(),
  name,
  role,
});

describe("lead contacts", () => {
  it("leads and co-leads only, by team then lead first then name; never contact details", () => {
    const out = leadContacts([
      entry("p1", "Zed", [team("Kitchen", "co_lead"), team("Gift", "member")]),
      entry("p2", "Remo", [team("Kitchen", "lead")]),
      entry("p3", "Ann", [team("Kitchen", "co_lead")]),
      entry("p4", "Jo", [team("Build", "lead")]),
      entry("p5", "Member", [team("Build", "member")]),
    ]);
    expect(out.map((l) => `${l.team}/${l.role}/${l.name}`)).toEqual([
      "Build/lead/Jo",
      "Kitchen/lead/Remo",
      "Kitchen/co_lead/Ann",
      "Kitchen/co_lead/Zed",
    ]);
    expect(JSON.stringify(out)).not.toMatch(/example\.test|\+27/);
  });

  it("someone leading two teams appears once per team", () => {
    const out = leadContacts([entry("p", "Sage", [team("A", "lead"), team("B", "lead")])]);
    expect(out.map((l) => l.team)).toEqual(["A", "B"]);
    expect(leadContacts([])).toEqual([]);
  });

  it("has the guide, packing list and rules", () => {
    expect(CAMP_GUIDE.guide.length).toBeGreaterThan(0);
    expect(CAMP_GUIDE.packing.join(" ")).toMatch(/water/i);
    expect(CAMP_GUIDE.rules.join(" ")).toMatch(/MOOP/);
  });
});
