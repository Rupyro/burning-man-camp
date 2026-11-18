// Applicant home, form, Open applications and the detail page (docs/specs/applicants.md §3–4, §7).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { saveApplication, updateApplication } from "../server/actions";
import { myApplication } from "../server/queries";
import { DetailPage } from "../ui/pages/detail";
import { FormPage } from "../ui/pages/form";
import { ApplicantHome } from "../ui/pages/home";
import { ReviewPage } from "../ui/pages/review";
import Router from "../ui/router";
import { applicantCamp, GOOD_ANSWERS } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

let p: Awaited<ReturnType<typeof applicantCamp>>;
const ctx = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const html = async (el: Promise<React.ReactNode>) => renderToStaticMarkup(await el);
const route = async (who: string, slug: string[], q: Record<string, string> = {}) => {
  await actAs(who);
  return html(Router({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(q) }));
};

async function interviewBooked() {
  await actAs(p.kai);
  await ok(saveApplication({ answers: GOOD_ANSWERS, submit: true }));
  const id = (await myApplication(getDb(), EDITION.id, p.kai))?.id ?? "";
  await actAs(p.lead);
  await ok(
    updateApplication({
      id,
      status: "interview_scheduled",
      interviewDate: "2027-01-20",
      interviewTime: "18:30",
    }),
  );
  return id;
}

describe("applicant pages", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("a new applicant: tracker at Not applied, a start button, the to-do, placeholder documents and the camp", async () => {
    const out = await html(ApplicantHome({ ctx: await ctx(p.kai), sent: false }));
    expect(out).toContain("Hi Kai");
    expect(out).toContain('aria-label="Application status"');
    expect(out).toContain("Not applied");
    expect(out).toContain("Start your application");
    expect(out).toContain("My to-do (6 left)");
    expect(out).toContain("Fill in and send the application form");
    expect(out).toContain("PLACEHOLDER:");
    expect(out).toContain("Camp agreement (placeholder)");
    expect(out).toContain("I&#x27;ve read this and agree");
    expect(out).toContain("About Oe-aa-sies");
    expect(out).toContain("The art car");
    expect(out).not.toContain("<img");
  });

  it("with an interview booked: the date on the tracker and in the headline, no start button", async () => {
    await interviewBooked();
    const out = await html(ApplicantHome({ ctx: await ctx(p.kai), sent: true }));
    expect(out).toContain("Your interview is booked for Wed 20 Jan at 18:30 SAST.");
    expect(out).toContain("20 Jan, 18:30");
    expect(out).toContain("Application sent. We&#x27;ll be in touch.");
    expect(out).not.toContain("Start your application");
    expect(out).toContain("Interview scheduled");
  });

  it("the form: PLACEHOLDER marked, required questions starred, answers kept", async () => {
    const empty = await html(FormPage({ ctx: await ctx(p.kai) }));
    expect(empty).toContain("PLACEHOLDER:");
    expect(empty).toContain("Why do you want to join Oe-aa-sies?");
    expect(empty).toContain("Send application");
    expect(empty).toContain("Save draft");
    await interviewBooked();
    const filled = await html(FormPage({ ctx: await ctx(p.kai) }));
    expect(filled).toContain("Friends camped with you and loved it.");
    expect(filled).toContain("Save changes");
    expect(filled).not.toContain("Save draft");
  });

  it("Open applications: counts by stage, this edition only, interview time in camp time", async () => {
    await interviewBooked();
    await actAs(p.noa);
    await ok(saveApplication({ answers: { why: "Draft" }, submit: false }));
    const out = await html(ReviewPage({ ctx: await ctx(p.lead), stage: undefined }));
    expect(out).toContain("Open applications");
    expect(out).toContain("All (2)");
    expect(out).toContain("Interview scheduled (1)");
    expect(out).toContain("Not applied (1)");
    expect(out).toContain("Kai Applicant");
    expect(out).toContain("Wed 20 Jan, 18:30");
    expect(out).not.toContain("Last year");
    const drafts = await html(ReviewPage({ ctx: await ctx(p.lead), stage: "draft" }));
    expect(drafts).toContain("Noa Applicant");
    expect(drafts).not.toContain("Kai Applicant");
  });

  it("detail: answers, requirements and the update form; never an email address", async () => {
    const id = await interviewBooked();
    const out = await html(DetailPage({ ctx: await ctx(p.lead), id }));
    expect(out).toContain("Kai Applicant");
    expect(out).toContain("Friends camped with you and loved it.");
    expect(out).toContain("Interview done: accept");
    expect(out).toContain("Lead note (only leads see this)");
    expect(out).not.toContain("kai@example.test");
    await expect(DetailPage({ ctx: await ctx(p.lead), id: p.oldApplication })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(DetailPage({ ctx: await ctx(p.lead), id: "not-a-uuid" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("applicants router (who gets what)", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("applicants get their home and form, and a 404 for Open applications and any detail", async () => {
    const id = await interviewBooked();
    expect(await route(p.kai, [])).toContain("Hi Kai");
    expect(await route(p.kai, ["form"])).toContain("Application form");
    await expect(route(p.kai, ["review"])).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(route(p.noa, ["review", id])).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(route(p.kai, ["nope"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("leads and admins land on Open applications; they have no form", async () => {
    await expect(route(p.lead, [])).rejects.toThrow("NEXT_REDIRECT /apply/review");
    expect(await route(p.admin, ["review"], { stage: "applied" })).toContain("Open applications");
    await expect(route(p.lead, ["form"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("members and finance approvers can't open the module at all", async () => {
    for (const who of [p.member, p.finance])
      await expect(route(who, [])).rejects.toThrow(/NEXT_NOT_FOUND|404/);
  });
});
