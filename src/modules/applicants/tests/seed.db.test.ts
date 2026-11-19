// The fake applicant seed (docs/specs/applicants.md §8): 14 applications at every stage from fake
// people, the demo Applicant persona reset on every run, fees through the event bus, idempotent.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  baseTables,
  createCamp,
  createPerson,
  dispatchPending,
  EDITION,
  getDb,
  seedEventsFor,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { applicantDocuments, applicantApplications as apps } from "../schema";
import { seed } from "../seed";

const named = async (name: string) =>
  (await getDb().select().from(baseTables.domainEvents)).filter((e) => e.name === name).length;
let ids: { admin: string; lead: string; member: string; applicant: string };

async function run() {
  await seed({
    db: getDb(),
    edition: EDITION,
    people: ids,
    tasks: await tasksApiFor(ids.admin),
    events: seedEventsFor("applicants"),
  });
  return dispatchPending();
}

describe("applicants seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    const person = (i: number, status: "prospect" | "waitlisted" | "confirmed") =>
      createPerson({
        email: `p${String(i).padStart(2, "0")}.${status}@example.test`,
        name: `Fake ${status} ${i}`,
        status,
      });
    for (let i = 0; i < 9; i++) await person(i, "prospect");
    for (let i = 0; i < 4; i++) await person(i, "waitlisted");
    for (let i = 0; i < 4; i++) await person(i, "confirmed");
    ids = {
      admin: await createPerson({ email: "admin@example.test", name: "Admin", roles: ["admin"] }),
      lead: await createPerson({
        email: "lead@example.test",
        name: "Lead",
        teams: [{ key: "kitchen", role: "lead" }],
      }),
      member: await createPerson({ email: "member@example.test", name: "Member" }),
      applicant: await createPerson({
        email: "applicant@example.test",
        name: "Kai (demo applicant)",
        status: "prospect",
      }),
    };
  });

  it("14 fake applications at every stage, the Applicant persona with an interview booked, and the Member persona just joined", async () => {
    expect(await run()).toMatchObject({ failed: 0 });
    const rows = await getDb().select().from(apps);
    expect(rows).toHaveLength(16);
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    expect({
      draft: count("draft"),
      applied: count("applied"),
      interview_scheduled: count("interview_scheduled"),
      accepted: count("accepted"),
      declined: count("declined"),
      joined: count("joined"),
    }).toEqual({
      draft: 2,
      applied: 3,
      interview_scheduled: 4,
      accepted: 2,
      declined: 1,
      joined: 4,
    });
    const member = rows.find((r) => r.personId === ids.member);
    expect(member?.status).toBe("joined");
    expect(member?.guideReadAt).toBeNull();
    const kai = rows.find((r) => r.personId === ids.applicant);
    expect(kai?.status).toBe("interview_scheduled");
    expect(kai?.interviewAt?.getTime()).toBeGreaterThan(Date.now());
    // Accepted applicants owe the camp fee: Finance made one each through the event bus.
    expect(await named("finance.fee.created")).toBe(2);
    expect(rows.filter((r) => r.status === "accepted").every((r) => r.feeCents === 45_000)).toBe(
      true,
    );
  });

  it("running twice adds nothing, and puts the persona back at the start", async () => {
    await run();
    const [kai] = await getDb().select().from(apps).where(eq(apps.personId, ids.applicant));
    await getDb()
      .update(apps)
      .set({ status: "joined" })
      .where(eq(apps.id, kai?.id ?? ""));
    await run();
    expect(await getDb().select().from(apps)).toHaveLength(16);
    expect(await named("applicants.application.accepted")).toBe(2);
    const [again] = await getDb().select().from(apps).where(eq(apps.personId, ids.applicant));
    expect(again?.status).toBe("interview_scheduled");
    const docs = await getDb()
      .select()
      .from(applicantDocuments)
      .where(eq(applicantDocuments.applicationId, again?.id ?? ""));
    expect(docs.map((d) => d.docKey)).toEqual(["principles"]);
  });
});
