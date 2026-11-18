// Server-side guard behaviour: every refusal path of moduleAction / sessionAction /
// publicAction / requireCapability / guardModulePage, independent of any one module.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ForbiddenError } from "@/base/api";
import {
  actAs,
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { guardModulePage } from "@/base/guard/guard-layout";
import {
  moduleAction,
  publicAction,
  requireCapability,
  sessionAction,
} from "@/base/guard/module-action";
import { getNow, setClock } from "@/base/guard/request";
import { ok } from "../api/testing";

let memberId: string;
let adminId: string;

const echo = moduleAction(
  "logistics",
  { input: z.object({ n: z.number().int() }), capability: "task.claim" },
  async (ctx, input) => ({
    n: input.n,
    moduleId: ctx.moduleId,
    names: await ctx.people.displayNames([ctx.actor.personId ?? ""]),
    none: await ctx.people.displayNames([]),
  }),
);

describe("moduleAction", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    memberId = await createPerson({ email: "member@example.test", name: "Member" });
    adminId = await createPerson({ email: "admin@example.test", name: "Admin", roles: ["admin"] });
  });

  it("refuses when signed out", async () => {
    await actAs(null);
    expect(await echo({ n: 1 })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("refuses a capability the manifest doesn't declare (programming error, not a 403)", async () => {
    await actAs(memberId);
    const bad = moduleAction(
      "logistics",
      { input: z.object({}), capability: "logistics.not.declared" },
      async () => "never",
    );
    await expect(bad({})).rejects.toThrow(/not declared in the logistics manifest/);
  });

  it("refuses an unknown module", async () => {
    await actAs(memberId);
    const ghost = moduleAction(
      "ghost" as "logistics",
      { input: z.object({}), capability: "task.claim" },
      async () => "never",
    );
    expect(await ghost({})).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("validates input on the server and reports each issue", async () => {
    await actAs(memberId);
    expect(await echo({ n: 1.5 })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      error: expect.stringMatching(/^Invalid input \(n: /),
    });
  });

  it("checks the capability against the loaded resource", async () => {
    const resource = vi.fn(async (input: { owner: string }, _ctx: unknown) => ({
      personId: input.owner,
    }));
    const viewContact = moduleAction(
      "logistics",
      {
        input: z.object({ owner: z.string() }),
        capability: "member.view_contacts",
        resource,
      },
      async () => "contact",
    );
    await actAs(memberId);
    expect(await viewContact({ owner: adminId })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    await expect(viewContact({ owner: memberId })).resolves.toBe("contact");
    expect(resource).toHaveBeenCalledTimes(2);
    expect(resource.mock.calls[0]?.[1]).toMatchObject({ edition: EDITION });
  });

  it("runs the handler with the base APIs bound to the transaction", async () => {
    await actAs(memberId);
    const result = await ok(echo({ n: 7 }));
    expect(result.n).toBe(7);
    expect(result.moduleId).toBe("logistics");
    expect([...result.names.values()]).toEqual(["Member"]);
    expect(result.none.size).toBe(0);
  });

  it("denies a member a capability only admins hold", async () => {
    await actAs(memberId);
    const moderate = moduleAction(
      "logistics",
      { input: z.object({}), capability: "logistics.export" },
      async () => "ok",
    );
    expect(await moderate({})).toMatchObject({ ok: false, code: "FORBIDDEN" });
    await actAs(adminId);
    await expect(moderate({})).resolves.toBe("ok");
  });
});

describe("sessionAction / publicAction / requireCapability", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    memberId = await createPerson({ email: "member@example.test", name: "Member" });
    adminId = await createPerson({ email: "admin@example.test", name: "Admin", roles: ["admin"] });
  });

  it("sessionAction needs a session and, if declared, the capability", async () => {
    const whoami = sessionAction({ input: z.object({}) }, async (ctx) => ctx.actor.personId);
    const adminOnly = sessionAction(
      { input: z.object({}), capability: "admin.settings" },
      async () => "admin",
    );
    await actAs(null);
    expect(await whoami({})).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    await actAs(memberId);
    await expect(whoami({})).resolves.toBe(memberId);
    expect(await adminOnly({})).toMatchObject({ ok: false, code: "FORBIDDEN" });
    await actAs(adminId);
    await expect(adminOnly({})).resolves.toBe("admin");
  });

  it("publicAction still validates input", async () => {
    const hello = publicAction({ input: z.object({ email: z.string().email() }) }, async (i) => i);
    await expect(hello({ email: "a@example.test" })).resolves.toEqual({ email: "a@example.test" });
    expect(await hello({ email: "nope" })).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("requireCapability throws ForbiddenError unless held", async () => {
    const ctx = { actor: await actorFor(memberId), edition: EDITION, now: new Date(), db: getDb() };
    await expect(requireCapability(ctx, "task.claim")).resolves.toBeUndefined();
    await expect(requireCapability(ctx, "admin.settings")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("guardModulePage and the test clock", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    memberId = await createPerson({ email: "member@example.test", name: "Member" });
  });

  it("passes slug, search params and a server-built context to the page", async () => {
    await actAs(memberId);
    const page = vi.fn(() => "rendered");
    const guarded = guardModulePage("logistics", page);
    await expect(
      guarded({ params: Promise.resolve({}), searchParams: Promise.resolve({ q: "x" }) }),
    ).resolves.toBe("rendered");
    await guarded({
      params: Promise.resolve({ slug: ["a", "b"] }),
      searchParams: Promise.resolve({}),
    });
    expect(page.mock.calls.map((c) => (c as unknown[])[0])).toMatchObject([
      { slug: [], searchParams: { q: "x" }, ctx: { edition: EDITION } },
      { slug: ["a", "b"] },
    ]);
  });

  it("getNow follows the test clock, then real time again", () => {
    const fixed = new Date("2027-04-21T06:00:00Z");
    setClock(() => fixed);
    expect(getNow()).toBe(fixed);
    setClock(undefined);
    expect(getNow()).not.toBe(fixed);
  });
});
