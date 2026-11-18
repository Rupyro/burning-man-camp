// A person's page shows only what the server returned (spec P2–P4).
import { describe, expect, it } from "vitest";
import type { PersonView } from "@/base/people/directory";
import { personFacts } from "./facts";

const base: PersonView = {
  personId: "p1",
  displayName: "Gift Member",
  playaName: null,
  pronouns: "they/them",
  bio: null,
  countryCode: "ZA",
  firstBurnYear: null,
  directoryVisibility: null,
  teams: [
    { id: "t1", key: "gift_projects", name: "Gift Projects", role: "member" },
    { id: "t2", key: "kitchen", name: "Kitchen", role: "co_lead" },
  ],
  skills: ["Carpentry"],
  travel: {
    arrivalAt: new Date("2027-04-21T08:00:00Z"),
    departureAt: null,
    earlyLeaveReason: null,
    buildCommitment: "full",
    strikeCommitment: "none",
    tentChoice: "byo_tent",
    availabilityNote: null,
  },
  availability: [],
  status: null,
  contact: null,
  dietary: null,
  payment: null,
  adminNotes: null,
  can: { edit: false, manage: false, notes: false },
};

describe("personFacts", () => {
  it("(deny) withheld fields don't appear at all", () => {
    expect(personFacts(base)).toEqual([
      ["Pronouns", "they/them"],
      ["Country", "ZA"],
      ["Teams", "Gift Projects, Kitchen (co lead)"],
      ["Skills", "Carpentry"],
      ["On site", "2027-04-21 to —"],
      ["Build / strike", "full / none"],
      ["Tent", "byo tent"],
    ]);
  });

  it("shows contacts, diet and payment when the server included them", () => {
    const facts = new Map(
      personFacts({
        ...base,
        status: "confirmed",
        travel: { ...base.travel, arrivalAt: null },
        contact: {
          email: "gift@example.test",
          phone: "+27820000001",
          emergencyContactName: "Mum",
          emergencyContactPhone: null,
        },
        dietary: { diet: "vegan", allergies: "peanuts" },
        payment: { status: "deposit_paid", syncedAt: null },
      }),
    );
    expect(facts.get("Email")).toBe("gift@example.test");
    expect(facts.get("Emergency contact")).toBe("Mum");
    expect(facts.get("Allergies")).toBe("peanuts");
    expect(facts.get("Payment (from the sheet)")).toBe("deposit paid");
    expect(facts.get("Status")).toBe("confirmed");
    expect(facts.has("On site")).toBe(false);
  });
});
