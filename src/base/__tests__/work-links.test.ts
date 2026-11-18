// Landing-page links to the task screens, from the caller's real permissions (spec S1–S4).
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { workLinks } from "@/base/landing/camp-links";

describe("workLinks", () => {
  it("confirmed members get My tasks, Projects and Notifications", () => {
    const hrefs = workLinks(persona("member")).map((l) => l.href);
    expect(hrefs).toEqual(["/tasks", "/projects", "/notifications"]);
  });

  it("people who can't see tasks only get Notifications", () => {
    expect(workLinks(persona("waitlisted")).map((l) => l.href)).toEqual(["/notifications"]);
  });
});
