// Request detail screen (docs/specs/finance.md §5).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { visibleRequests } from "../server/queries";
import { DetailPage } from "../ui/pages/detail";
import { seededCamp } from "./seeded";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let p: Awaited<ReturnType<typeof seededCamp>>;
const ctxFor = async (who: string) => ({
  actor: await actorFor(who),
  edition: EDITION,
  now: new Date(),
  db: getDb(),
});
const idOf = async (title: string) =>
  (await visibleRequests(getDb(), EDITION.id, await actorFor(p.finance))).find((r) =>
    r.title.startsWith(title),
  )?.id ?? "";
const detail = async (who: string, title: string) =>
  renderToStaticMarkup(await DetailPage({ ctx: await ctxFor(who), id: await idOf(title) }));

describe("finance request screens", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("the approver gets the decision buttons; the requester doesn't", async () => {
    expect(await detail(p.finance, "Propane tanks")).toContain("Your call");
    const own = await detail(p.member, "Propane tanks");
    expect(own).not.toContain("Your call");
    expect(own).toContain("Cancel request");
    expect(own).toContain("OEA-SR-001".replace("OEA", "TST"));
  });

  it("approved: the requester can record what it cost; history shows who said yes", async () => {
    const out = await detail(p.member, "Ice for build week");
    expect(out).toContain("Bought it?");
    expect(out).toContain("Alex</strong> approved");
  });

  it("pay-back owed: finance sees Mark paid; the payee doesn't", async () => {
    expect(await detail(p.finance, "Spices")).toContain("Mark paid");
    const own = await detail(p.member, "Spices");
    expect(own).not.toContain("Mark paid");
    expect(own).toContain("Pay-back: owed");
  });

  it("sent back: the requester can answer and resend", async () => {
    const id = await idOf("LED strips");
    const out = renderToStaticMarkup(await DetailPage({ ctx: await ctxFor(p.giftLead), id }));
    expect(out).toContain("Answer and resend");
    expect(out).toContain("Which supplier, and how many metres?");
  });

  it("404 for outsiders, other teams' leads, bad and unknown ids", async () => {
    const gas = await idOf("Propane tanks");
    await expect(DetailPage({ ctx: await ctxFor(p.outsider), id: gas })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(DetailPage({ ctx: await ctxFor(p.giftLead), id: gas })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(DetailPage({ ctx: await ctxFor(p.member), id: "nope" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      DetailPage({ ctx: await ctxFor(p.member), id: "01900000-0000-7000-8000-00000000dead" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
