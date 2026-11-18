// The demo "New applicant" persona (Sage, 21 Oct 2026): just sent the form, nothing else yet,
// reset on every seed so the first-time experience is always there to try.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { applicantDocuments, applicantApplications as apps } from "../schema";
import { seed } from "../seed";

let ids: { admin: string; lead: string; member: string; new_applicant: string };
const run = async () =>
  seed({ db: getDb(), edition: EDITION, people: ids, tasks: await tasksApiFor(ids.admin) });

describe("applicants seed: New applicant persona", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    ids = {
      admin: await createPerson({ email: "admin@example.test", name: "Admin", roles: ["admin"] }),
      lead: await createPerson({ email: "lead@example.test", name: "Lead" }),
      member: await createPerson({ email: "member@example.test", name: "Member" }),
      new_applicant: await createPerson({
        email: "new-applicant@example.test",
        name: "Nia (demo new applicant)",
        status: "prospect",
      }),
    };
  });

  it("applied today: form sent, no interview, no documents, no fee", async () => {
    await run();
    const [nia] = await getDb().select().from(apps).where(eq(apps.personId, ids.new_applicant));
    expect(nia?.status).toBe("applied");
    expect(nia?.submittedAt).not.toBeNull();
    expect(Date.now() - (nia?.submittedAt?.getTime() ?? 0)).toBeLessThan(86_400_000);
    expect(nia?.interviewAt).toBeNull();
    expect(nia?.feeCents).toBeNull();
    const docs = await getDb()
      .select()
      .from(applicantDocuments)
      .where(eq(applicantDocuments.applicationId, nia?.id ?? ""));
    expect(docs).toHaveLength(0);
  });

  it("a re-seed puts them back at 'just applied'", async () => {
    await run();
    await getDb()
      .update(apps)
      .set({ status: "interview_scheduled" })
      .where(eq(apps.personId, ids.new_applicant));
    await run();
    const [nia] = await getDb().select().from(apps).where(eq(apps.personId, ids.new_applicant));
    expect(nia?.status).toBe("applied");
  });
});
