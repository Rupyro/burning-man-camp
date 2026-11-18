import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sidebar, TabBar } from "./app-nav";

describe("app navigation (spec B3 §3.6, §4)", () => {
  it("tab bar: Home, Tasks, Alerts with unread count; leads lose it from md up", () => {
    const member = renderToStaticMarkup(h(TabBar, { unread: 3, everywhere: true }));
    for (const t of ["Home", "Tasks", "Alerts (3)"]) expect(member).toContain(t);
    // My profile lives only top right (Sage, 21 Oct 2026): no Me tab.
    expect(member).not.toContain('href="/me"');
    expect(member).not.toContain(">Me<");
    expect(member).not.toContain("md:hidden");
    const lead = renderToStaticMarkup(h(TabBar, { unread: 0, everywhere: false }));
    expect(lead).toContain(">Alerts<");
    expect(lead).toContain("md:hidden");
  });

  it("sidebar shows only the links it is given; empty sections are left out", () => {
    const full = renderToStaticMarkup(
      h(Sidebar, {
        work: [
          { href: "/tasks", label: "My tasks" },
          { href: "/projects", label: "Projects" },
        ],
        modules: [{ href: "/logistics", label: "Logistics", icon: "hand" }],
        admin: [{ href: "/edition", label: "Edition settings" }],
      }),
    );
    expect(full).toContain('href="/logistics"');
    expect(full).toContain("Edition settings");
    const bare = renderToStaticMarkup(h(Sidebar, { work: [], modules: [], admin: [] }));
    expect(bare).not.toContain('aria-label="Modules"');
    expect(bare).not.toContain('aria-label="Admin"');
  });
});
