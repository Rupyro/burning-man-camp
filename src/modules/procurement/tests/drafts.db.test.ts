// Drafts through the guard: a lead asks, edits, discards or sends; nothing goes out without a tap;
// every step is logged; the daily review page for admins.
import { eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { procurementDraftLog, procurementDrafts } from "../schema";
import { askTheCamp, fixAsk } from "../server/ask";
import {
  discardDraft,
  editDraft,
  makeDraft,
  markWhatsappOpened,
  sendDraft,
} from "../server/drafts";
import { dailyReview } from "../server/review-queries";
import { DraftsPage } from "../ui/pages/drafts";
import { ReviewPage } from "../ui/pages/review";
import { procurementCamp } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

let p: Awaited<ReturnType<typeof procurementCamp>>;
const draftOf = async (id: string) =>
  (await getDb().select().from(procurementDrafts).where(eq(procurementDrafts.id, id)))[0];
const logOf = (id: string) =>
  getDb().select().from(procurementDraftLog).where(eq(procurementDraftLog.draftId, id));
const outbox = async () =>
  (await getDb().execute(sql`select to_email, template, payload from email_outbox`)) as unknown as {
    to_email: string;
    template: string;
    payload: { subject: string; text: string };
  }[];
const ctxOf = async (who: string, now = new Date()) =>
  ({ actor: await actorFor(who), edition: EDITION, now, db: getDb() }) as Parameters<
    typeof DraftsPage
  >[0]["ctx"];

const email = {
  kind: "email" as const,
  to: "orders@tankwa-ice.example",
  ask: "a quote for 200 kg of ice on 27 April",
};

describe("drafts", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("writes a labelled demo draft, queues nothing until Send, then sends once", async () => {
    await actAs(p.kitchenLead);
    const d = await ok(makeDraft(email));
    const row = await draftOf(d.id);
    expect(row).toMatchObject({
      status: "draft",
      writer: "demo",
      teamId: p.kitchen,
      aiCostCents: 0,
    });
    expect(row?.body).toContain("Alex, Oe-aa-sies Kitchen");
    expect(await outbox()).toEqual([]);
    await ok(
      editDraft({ id: d.id, to: email.to, subject: "Ice quote", body: "Hi, 200 kg please." }),
    );
    await ok(sendDraft({ id: d.id }));
    const sent = await outbox();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to_email: email.to, template: "procurement.draft" });
    expect(sent[0]?.payload).toMatchObject({ subject: "Ice quote", text: "Hi, 200 kg please." });
    expect((await draftOf(d.id))?.status).toBe("sent");
    expect((await logOf(d.id)).map((l) => l.action).sort()).toEqual(["drafted", "edited", "sent"]);
    await expect(ok(sendDraft({ id: d.id }))).rejects.toThrow(ValidationError);
    await expect(
      ok(editDraft({ id: d.id, to: email.to, subject: "x", body: "y" })),
    ).rejects.toThrow(ValidationError);
  });

  it("an email needs a real address before it can be sent", async () => {
    await actAs(p.kitchenLead);
    const d = await ok(makeDraft({ ...email, to: "the ice people" }));
    await expect(ok(sendDraft({ id: d.id }))).rejects.toThrow(ValidationError);
    expect(await outbox()).toEqual([]);
  });

  it("WhatsApp only opens a link; the tap is logged and nothing is emailed", async () => {
    await actAs(p.kitchenLead);
    const d = await ok(
      makeDraft({ kind: "whatsapp", to: "Camp group", ask: "loading starts at 10 am" }),
    );
    await expect(ok(sendDraft({ id: d.id }))).rejects.toThrow(ValidationError);
    const r = await ok(markWhatsappOpened({ id: d.id }));
    expect(r.link).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect((await draftOf(d.id))?.status).toBe("sent");
    expect(await outbox()).toEqual([]);
    expect((await logOf(d.id)).map((l) => l.action).sort()).toEqual(["drafted", "opened_whatsapp"]);
  });

  it("discard keeps the row and logs it; only the writer or a lead of the team may act", async () => {
    await actAs(p.kitchenLead);
    const d = await ok(makeDraft(email));
    await actAs(p.lead);
    await expect(ok(discardDraft({ id: d.id }))).rejects.toThrow(ForbiddenError);
    await expect(ok(sendDraft({ id: d.id }))).rejects.toThrow(ForbiddenError);
    await actAs(p.member);
    await expect(ok(makeDraft(email))).rejects.toThrow(ForbiddenError);
    await actAs(p.camp);
    await ok(discardDraft({ id: d.id }));
    expect((await draftOf(d.id))?.status).toBe("discarded");
    expect((await logOf(d.id)).map((l) => l.action).sort()).toEqual(["discarded", "drafted"]);
  });

  it("the drafts page shows the demo label, Edit, Discard and the right send button", async () => {
    await actAs(p.kitchenLead);
    await ok(makeDraft(email));
    await ok(makeDraft({ kind: "whatsapp", to: "Camp group", ask: "loading starts at 10 am" }));
    const html = renderToStaticMarkup(await DraftsPage({ ctx: await ctxOf(p.kitchenLead) }));
    expect(html).toContain("Demo version");
    expect(html).toContain("Send email");
    expect(html).toContain("Open in WhatsApp");
    expect(html).toContain("Discard");
    expect(html).toContain("Edit");
    expect(html).toContain("Nothing is sent until you press Send");
    const member = renderToStaticMarkup(await DraftsPage({ ctx: await ctxOf(p.member) }));
    expect(member).toContain("Drafts are for team leads");
  });
});

describe("daily review", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("lists yesterday's asks, drafts and fixes, flags old drafts and moves, and the spend", async () => {
    await actAs(p.kitchenLead);
    const a = await ok(askTheCamp({ text: "need rope for the shade" }));
    await ok(fixAsk({ askId: a.id, action: "change_owner", ownerPersonId: p.kitchenLead }));
    const d = await ok(makeDraft(email));
    const later = new Date(Date.now() + 2.5 * 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    const r = await dailyReview(await ctxOf(p.admin, tomorrow));
    expect(r.asks.map((x) => x.text)).toEqual(["need rope for the shade"]);
    expect(r.drafts.map((x) => x.id)).toEqual([d.id]);
    expect(r.fixes).toHaveLength(1);
    expect(r.flags.some((f) => f.kind === "moved")).toBe(true);
    expect(r.flags.some((f) => f.kind === "stale_draft")).toBe(false);
    const r2 = await dailyReview(await ctxOf(p.admin, later));
    expect(r2.flags.some((f) => f.kind === "stale_draft")).toBe(true);
    expect(r2.capCents).toBe(15_000);
    expect(r2.spentCents).toBe(0);
    const html = renderToStaticMarkup(await ReviewPage({ ctx: await ctxOf(p.admin, later) }));
    expect(html).toContain("Worth a look");
    expect(html).toContain("has been a draft for 2 days");
    expect(html).toContain("Running total");
    const lead = renderToStaticMarkup(await ReviewPage({ ctx: await ctxOf(p.kitchenLead) }));
    expect(lead).toContain("The daily review is for camp admins");
  });
});
