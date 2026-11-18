// New request screen (docs/specs/finance.md §5).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import { NewRequestPage } from "../ui/pages/new";
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

describe("new request screen", () => {
  beforeEach(async () => {
    p = await seededCamp();
  });

  it("new request: only teams with a budget; nothing for people on no team", async () => {
    const out = renderToStaticMarkup(await NewRequestPage({ ctx: await ctxFor(p.member) }));
    expect(out).toContain(">Kitchen</option>");
    expect(out).toContain("Send for approval");
    const none = renderToStaticMarkup(await NewRequestPage({ ctx: await ctxFor(p.outsider) }));
    expect(none).toContain("None of your teams has a budget yet");
  });
});
