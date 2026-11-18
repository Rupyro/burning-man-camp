// The landing page's "Edition settings" link (spec b1-12 E6).
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { campSettingsLinks, settingsLinks } from "@/base/landing/camp-links";

const hrefs = (name: Parameters<typeof persona>[0]) =>
  settingsLinks(persona(name)).map((l) => l.href);

describe("settingsLinks", () => {
  it("the camp lead and admins get Edition settings", () => {
    expect(hrefs("camp_lead")).toEqual(["/edition"]);
    expect(hrefs("admin")).toEqual(["/edition"]);
  });

  it("(deny) members, team leads, waitlisted and alumni don't", () => {
    for (const p of ["member", "team_lead", "waitlisted", "alumni"] as const) {
      expect(hrefs(p)).toEqual([]);
    }
  });
});

describe("campSettingsLinks", () => {
  it("admins get Camp settings; nobody else does", () => {
    expect(campSettingsLinks(persona("admin")).map((l) => l.href)).toEqual(["/settings"]);
    for (const p of ["camp_lead", "member", "team_lead"] as const)
      expect(campSettingsLinks(persona(p))).toEqual([]);
  });
});
