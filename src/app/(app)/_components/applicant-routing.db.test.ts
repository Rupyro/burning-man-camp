// Routing by role and the applicant-only view (docs/specs/applicants.md §1, §7): applicants can't
// reach member, finance or lead pages; members, leads and admins never see the applicant shell.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleId } from "@/base/api";
import { actAs, actorFor, landingFor, layoutStatus } from "@/base/api/testing-db";
import { can } from "@/base/authz/permissions";
import { applicantRedirectTarget, homeFor } from "@/base/landing/applicant";
import { applicantCamp } from "@/modules/applicants/tests/fixtures";
import AppLayout from "../layout";
import HomePage from "../page";
import UpNextPage from "../up-next/page";
import { basePage } from "./base-page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/apply",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
}));

let p: Awaited<ReturnType<typeof applicantCamp>>;
const MEMBER_MODULES: ModuleId[] = ["finance", "procurement", "logistics", "obligations"];

describe("routing by role", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("applicants land on /apply; members, leads and admins on the home page", async () => {
    expect(homeFor(await actorFor(p.kai))).toBe("/apply");
    expect(homeFor(await actorFor(p.wes))).toBe("/apply");
    for (const who of [p.member, p.lead, p.camp, p.admin]) {
      expect(homeFor(await actorFor(who))).toBe("/");
      expect(applicantRedirectTarget(await actorFor(who))).toBeNull();
    }
  });

  it("applicants: every member module is a 404; the applicant module opens", async () => {
    for (const m of MEMBER_MODULES) expect(await layoutStatus(m, p.kai), m).toBe("404");
    expect(await layoutStatus("applicants", p.kai)).toBe("ok");
    expect(await layoutStatus("applicants", p.wes)).toBe("ok");
  });

  it("applicants: home, See all, Shifts and base screens send them to /apply", async () => {
    await actAs(p.kai);
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT /apply");
    await expect(UpNextPage()).rejects.toThrow("NEXT_REDIRECT /apply");
    // Shifts is now a module: its guarded layout hides it from applicants (the app layout sends them to /apply).
    expect(await layoutStatus("shifts", p.kai)).toBe("404");
    await expect(basePage(async () => "people directory")).rejects.toThrow("NEXT_REDIRECT /apply");
  });

  it("applicants: no lead or member powers, and only the Applications tile", async () => {
    const kai = await actorFor(p.kai);
    for (const cap of [
      "readiness.view",
      "task.view",
      "member.view_directory",
      "finance.view",
    ] as const)
      expect(can(kai, cap), cap).toBe(false);
    expect((await landingFor(p.kai)).tiles.map((t) => t.id)).toEqual(["applicants"]);
  });

  it("applicants get the slim shell: no member tabs, sidebar or profile link", async () => {
    await actAs(p.kai);
    const out = renderToStaticMarkup(await AppLayout({ children: "child" }));
    expect(out).toContain('aria-label="My application"');
    expect(out).toContain("child");
    expect(out).not.toContain('aria-label="Tabs"');
    expect(out).not.toContain("/notifications");
    expect(out).not.toContain('href="/me"');
  });

  it("members and leads keep their screens, and can't open the applicant module unless they review", async () => {
    await actAs(p.member);
    await expect(basePage(async () => "people directory")).resolves.toBe("people directory");
    // Members can open the module only for the "You're in" welcome page; every other page still 404s.
    expect(await layoutStatus("applicants", p.member)).toBe("ok");
    expect(await layoutStatus("applicants", p.lead)).toBe("ok");
    expect(await layoutStatus("finance", p.member)).toBe("ok");
    await actAs(p.lead);
    const out = renderToStaticMarkup(await AppLayout({ children: "child" }));
    expect(out).toContain('aria-label="Tabs"');
    expect(out).not.toContain('aria-label="My application"');
  });
});
