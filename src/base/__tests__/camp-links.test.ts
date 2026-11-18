// Landing page "Camp" section: links and "you are" line follow the caller's real roles (spec L1).
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { campSection } from "@/base/landing/camp-links";

const hrefs = (name: Parameters<typeof persona>[0]) =>
  campSection(persona(name)).links.map((l) => l.href);

describe("campSection", () => {
  it("a confirmed member gets their profile, people and teams", () => {
    expect(hrefs("member")).toEqual(["/me", "/people", "/teams"]);
  });

  it("an admin also gets the member import", () => {
    expect(hrefs("admin")).toEqual(["/me", "/people", "/teams", "/people/import"]);
  });

  it("(deny) waitlisted and alumni get only their own profile", () => {
    expect(hrefs("waitlisted")).toEqual(["/me"]);
    expect(hrefs("alumni")).toEqual(["/me"]);
  });

  it("(deny) camp leads and team leads don't get the import", () => {
    expect(hrefs("camp_lead")).not.toContain("/people/import");
    expect(hrefs("team_lead")).not.toContain("/people/import");
  });

  it("says who you are from roles and team roles, roles first", () => {
    const lead = persona("team_lead", { roles: ["camp_lead"] });
    expect(campSection(lead).youAre).toEqual(["Camp lead", "Kitchen lead"]);
    expect(campSection(persona("waitlisted")).youAre).toEqual(["Waitlisted"]);
    expect(campSection(persona("member")).youAre).toEqual(["Member"]);
  });
});
