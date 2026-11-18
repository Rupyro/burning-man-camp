// Shared setup for applicants DB tests: a camp with a camp lead, a Kitchen lead, a member, a finance
// approver, an admin, two prospects and a waitlisted person, plus an application in another edition.
import { editions } from "@/base/api/schema";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import { applicantApplications } from "../schema";

export const OTHER_EDITION = { id: "01900000-0000-7000-8000-000000002026", year: 2026 };

export async function applicantCamp() {
  await truncateAll();
  await createCamp();
  const p = {
    camp: await createPerson({
      email: "camp@example.test",
      name: "Cam Lead",
      roles: ["camp_lead"],
    }),
    admin: await createPerson({ email: "admin@example.test", name: "Ada", roles: ["admin"] }),
    lead: await createPerson({
      email: "alex@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    }),
    member: await createPerson({
      email: "sam@example.test",
      name: "Sam",
      teams: [{ key: "kitchen", role: "member" }],
    }),
    finance: await createPerson({
      email: "jules@example.test",
      name: "Jules",
      roles: ["finance_approver"],
    }),
    kai: await createPerson({
      email: "kai@example.test",
      name: "Kai Applicant",
      status: "prospect",
    }),
    noa: await createPerson({
      email: "noa@example.test",
      name: "Noa Applicant",
      status: "prospect",
    }),
    wes: await createPerson({ email: "wes@example.test", name: "Wes", status: "waitlisted" }),
  };
  // Last year's application from Noa: never listed or reachable this year.
  await getDb().insert(editions).values({
    id: OTHER_EDITION.id,
    year: OTHER_EDITION.year,
    title: "AfrikaBurn 2026",
    status: "closed",
  });
  const [old] = await getDb()
    .insert(applicantApplications)
    .values({
      editionId: OTHER_EDITION.id,
      personId: p.noa,
      status: "applied",
      submittedAt: new Date("2025-12-01T10:00:00Z"),
      answers: { why: "Last year's answer" },
    })
    .returning();
  return { ...p, oldApplication: old?.id ?? "", edition: EDITION };
}

/** Answers that pass the placeholder form's required questions. */
export const GOOD_ANSWERS = {
  country: "South Africa",
  burns: "First burn",
  why: "Friends camped with you and loved it.",
  contribute: "Kitchen and build",
  build_strike: "Both",
};
