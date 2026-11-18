// Module nav bar (Sage, 21 Oct 2026): a bar whose only link is the module home just repeats the
// module name ("Shifts Shifts" above the "Shifts" heading), so it is left out.
import { describe, expect, it } from "vitest";
import { moduleNavLinks } from "@/base/guard/module-nav";

describe("module nav links", () => {
  it("a single link back to the module home: no bar", () => {
    expect(moduleNavLinks("/shifts", [{ label: "Shifts", path: "" }])).toEqual([]);
  });
  it("two or more links: all of them, home first as given", () => {
    expect(
      moduleNavLinks("/finance", [
        { label: "Money", path: "" },
        { label: "New request", path: "new" },
      ]),
    ).toEqual([
      { href: "/finance", label: "Money" },
      { href: "/finance/new", label: "New request" },
    ]);
  });
  it("a single link somewhere else in the module is kept", () => {
    expect(moduleNavLinks("/x", [{ label: "Queue", path: "queue" }])).toEqual([
      { href: "/x/queue", label: "Queue" },
    ]);
  });
});
