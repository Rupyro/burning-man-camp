// Applicant and lead actions through the guard (docs/specs/applicants.md §2–5): the form, documents,
// lead moves, audit, and the wrong-record / wrong-edition / wrong-person refusals.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { eventContracts } from "@/contracts/events";
import { applicantDocuments, applicantApplications as apps } from "../schema";
import { confirmDocument, saveApplication, updateApplication } from "../server/actions";
import { myApplication } from "../server/queries";
import { applicantCamp, GOOD_ANSWERS } from "./fixtures";

let p: Awaited<ReturnType<typeof applicantCamp>>;
const appOf = async (personId: string) => myApplication(getDb(), EDITION.id, personId);

async function applied(who = p.kai) {
  await actAs(who);
  await ok(saveApplication({ answers: GOOD_ANSWERS, submit: true }));
  return (await appOf(who))?.id ?? "";
}

describe("applicant actions", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("saves a partial draft, then refuses to send until every required answer is there", async () => {
    await actAs(p.kai);
    expect(await ok(saveApplication({ answers: { why: "Because" }, submit: false }))).toEqual({
      ok: true,
      sent: false,
    });
    expect(await appOf(p.kai)).toMatchObject({
      status: "draft",
      submittedAt: null,
      answers: { why: "Because" },
    });
    const r = await ok(saveApplication({ answers: { why: "Because" }, submit: true }));
    expect(r.ok).toBe(false);
    expect((await appOf(p.kai))?.status).toBe("draft");
  });

  it("sending moves it to Applied with a timestamp and an audit row (answers redacted)", async () => {
    const id = await applied();
    const app = await appOf(p.kai);
    expect(app).toMatchObject({ status: "applied", answers: GOOD_ANSWERS });
    expect(app?.submittedAt).toBeInstanceOf(Date);
    const audit = await getDb()
      .select()
      .from(baseTables.auditEvents)
      .where(eq(baseTables.auditEvents.entityId, id));
    expect(audit.map((a) => a.action)).toContain("applicants.application.submitted");
    expect(JSON.stringify(audit)).not.toContain("Friends camped");
  });

  it("answers stay editable until a decision, then lock", async () => {
    const id = await applied();
    await actAs(p.kai);
    expect(
      await ok(saveApplication({ answers: { ...GOOD_ANSWERS, country: "Germany" }, submit: true })),
    ).toEqual({
      ok: true,
      sent: true,
    });
    await actAs(p.lead);
    await ok(updateApplication({ id, status: "declined" }));
    await actAs(p.kai);
    await expect(
      ok(saveApplication({ answers: GOOD_ANSWERS, submit: false })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(ok(confirmDocument({ docKey: "principles" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("confirms a document once (twice is harmless) and refuses unknown documents", async () => {
    await actAs(p.kai);
    expect(await ok(confirmDocument({ docKey: "principles" }))).toEqual({ joined: false });
    await ok(confirmDocument({ docKey: "principles" }));
    const app = await appOf(p.kai);
    expect(app?.docsDone).toEqual(["principles"]);
    expect(app?.status).toBe("draft");
    await expect(ok(confirmDocument({ docKey: "passport_scan" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("only applicants may apply: members, leads and admins are refused", async () => {
    for (const who of [p.member, p.lead, p.admin, p.camp]) {
      await actAs(who);
      await expect(
        ok(saveApplication({ answers: GOOD_ANSWERS, submit: true })),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(ok(confirmDocument({ docKey: "principles" }))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
  });
});

describe("lead actions (Open applications)", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("books an interview (camp time), re-books it, accepts with the interview held, and audits", async () => {
    const id = await applied();
    await actAs(p.lead);
    expect(await ok(updateApplication({ id, status: "interview_scheduled" }))).toEqual({
      changed: false,
      joined: false,
      error: "Pick the interview date and time",
    });
    await ok(
      updateApplication({
        id,
        status: "interview_scheduled",
        interviewDate: "2027-01-20",
        interviewTime: "18:30",
      }),
    );
    expect((await appOf(p.kai))?.interviewAt?.toISOString()).toBe("2027-01-20T16:30:00.000Z");
    await ok(
      updateApplication({
        id,
        status: "interview_scheduled",
        interviewDate: "2027-01-22",
        interviewTime: "09:00",
      }),
    );
    expect((await appOf(p.kai))?.interviewAt?.toISOString()).toBe("2027-01-22T07:00:00.000Z");
    const r = await ok(updateApplication({ id, status: "accepted", note: "Lovely chat" }));
    expect(r).toEqual({ changed: true, joined: false, error: null });
    const app = await appOf(p.kai);
    expect(app).toMatchObject({
      status: "accepted",
      decidedByPersonId: p.lead,
      leadNote: "Lovely chat",
    });
    expect(app?.interviewDoneAt).toBeInstanceOf(Date);
    const actions = (
      await getDb()
        .select()
        .from(baseTables.auditEvents)
        .where(eq(baseTables.auditEvents.entityId, id))
    ).map((a) => a.action);
    expect(actions.filter((a) => a === "applicants.application.updated")).toHaveLength(3);
  });

  it("accepting emits one valid applicants.application.accepted event", async () => {
    const id = await applied();
    await actAs(p.camp);
    await ok(
      updateApplication({
        id,
        status: "interview_scheduled",
        interviewDate: "2027-01-20",
        interviewTime: "18:30",
      }),
    );
    await ok(updateApplication({ id, status: "accepted" }));
    const events = (await getDb().select().from(baseTables.domainEvents)).filter(
      (e) => e.name === "applicants.application.accepted",
    );
    expect(events).toHaveLength(1);
    expect(eventContracts["applicants.application.accepted"].parse(events[0]?.payload)).toEqual({
      v: 1,
      applicationId: id,
      personId: p.kai,
      editionId: EDITION.id,
    });
  });

  it("refuses moves the table doesn't allow, and a note-only save changes just the note", async () => {
    const id = await applied();
    await actAs(p.admin);
    expect((await ok(updateApplication({ id, status: "accepted" }))).error).toBe(
      "Can't move an application from Applied to Accepted",
    );
    expect(await ok(updateApplication({ id, note: "Call after 6" }))).toEqual({
      changed: true,
      joined: false,
      error: null,
    });
    expect(await ok(updateApplication({ id, note: "Call after 6" }))).toEqual({
      changed: false,
      joined: false,
      error: null,
    });
    expect((await appOf(p.kai))?.status).toBe("applied");
    await ok(updateApplication({ id, status: "declined" }));
    await ok(updateApplication({ id, status: "applied" }));
    expect(await appOf(p.kai)).toMatchObject({
      status: "applied",
      decidedAt: null,
      decidedByPersonId: null,
    });
  });

  it("members, finance approvers and applicants can't update an application", async () => {
    const id = await applied();
    for (const who of [p.member, p.finance, p.noa, p.kai, p.wes]) {
      await actAs(who);
      await expect(ok(updateApplication({ id, status: "declined" }))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    expect((await appOf(p.kai))?.status).toBe("applied");
  });

  it("wrong record: another edition's application or a made-up id is refused", async () => {
    await actAs(p.lead);
    await expect(
      ok(updateApplication({ id: p.oldApplication, status: "declined" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      ok(updateApplication({ id: "01900000-0000-7000-8000-0000000000aa", status: "declined" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const [old] = await getDb().select().from(apps).where(eq(apps.id, p.oldApplication));
    expect(old?.status).toBe("applied");
  });

  it("documents belong to the applicant's own application only", async () => {
    await applied(p.kai);
    await applied(p.noa);
    await actAs(p.noa);
    await ok(confirmDocument({ docKey: "ticket_plan" }));
    const kai = await appOf(p.kai);
    const rows = await getDb()
      .select()
      .from(applicantDocuments)
      .where(and(eq(applicantDocuments.applicationId, kai?.id ?? "")));
    expect(rows).toEqual([]);
  });
});
