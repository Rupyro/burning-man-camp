import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PersonaPicker } from "./persona-picker";

// The server action needs a Next request; rendering the cards doesn't call it.
vi.mock("@/base/demo/server/actions", () => ({ demoSignIn: vi.fn() }));

describe("demo role picker", () => {
  it("one card per persona", () => {
    const out = renderToStaticMarkup(h(PersonaPicker));
    // Seven since the New applicant persona, shown first (Sage, 21 Oct 2026).
    for (const label of [
      "New applicant",
      "Member",
      "Team lead",
      "Diet viewer",
      "Finance approver",
      "Applicant",
      "Admin",
    ])
      expect(out).toContain(label);
    expect(out.match(/data-persona="/g)).toHaveLength(7);
    expect(out.indexOf('data-persona="new_applicant"')).toBeLessThan(
      out.indexOf('data-persona="member"'),
    );
    expect(out).toContain('data-persona="applicant"');
    expect(out).toContain('data-persona="kitchen_lead"');
  });
});
