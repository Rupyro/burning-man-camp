// Demo persona sign-in goes through the normal magic-link path (docs/specs/b3-demo-mode.md §2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCamp, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import { resetAuthForTests } from "@/base/auth/auth";
import { armCapture, captureLink, takeCaptured } from "@/base/demo/capture";
import { seedPersonas } from "@/base/demo/seed-personas";
import { demoLinkFor } from "@/base/demo/sign-in";
import { sentEmails } from "@/base/email/adapter";
import { ForbiddenError } from "@/base/errors";

const saved = process.env.DEMO_MODE;
afterEach(() => {
  if (saved === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = saved;
});

describe("demo link capture", () => {
  it("captures only armed emails, once", () => {
    expect(captureLink("a@example.test", "u1")).toBe(false);
    armCapture("a@example.test");
    expect(captureLink("a@example.test", "u2")).toBe(true);
    expect(takeCaptured("a@example.test")).toBe("u2");
    expect(takeCaptured("a@example.test")).toBeNull();
    expect(captureLink("a@example.test", "u3")).toBe(false);
  });
});

describe("demo sign-in", () => {
  beforeEach(async () => {
    resetAuthForTests();
    await truncateAll();
    await createCamp();
    await seedPersonas(getDb(), EDITION.id);
  });

  it("off by default: refused", async () => {
    delete process.env.DEMO_MODE;
    await expect(demoLinkFor("member", new Headers())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("on: hands back a normal magic link for the persona, and emails nothing", async () => {
    process.env.DEMO_MODE = "true";
    const before = sentEmails().length;
    const link = await demoLinkFor("kitchen_lead", new Headers());
    expect(link).toMatch(/\/api\/auth\/magic-link\/verify\?token=/);
    expect(sentEmails().length).toBe(before);
  });

  it("an unknown persona gets nothing", async () => {
    process.env.DEMO_MODE = "true";
    expect(await demoLinkFor("root", new Headers())).toBeNull();
  });
});
