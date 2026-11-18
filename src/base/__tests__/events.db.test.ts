import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, truncateAll } from "@/base/api/testing-db";
import { Actor } from "@/base/authz/actor";
import { getDb } from "@/base/db/client";
import { dispatchEvents, MAX_DELIVERY_ATTEMPTS } from "@/base/events/dispatch";
import { buildActionContext } from "@/base/guard/context";
import { buildRegistry } from "@/base/registry/runtime";
import type { ModuleManifest } from "@/base/registry/types";
import { domainEventDeliveries, domainEvents } from "@/base/schema";

// A fake emitter + listener pair built on the real contract, independent of any real module.
let calls = 0;
let failNext = false;
const emitter = {
  id: "applicants",
  name: "Applicants",
  description: "",
  icon: "hand",
  route: "/applicants",
  tablePrefix: "applicant_",
  access: [{ everyone: true }],
  permissions: [],
  nav: [],
  events: { emits: ["applicants.application.accepted"] },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
const listener = {
  ...emitter,
  id: "content",
  route: "/content",
  tablePrefix: "content_",
  events: {
    handles: {
      "applicants.application.accepted": async () => ({
        default: async () => {
          calls++;
          if (failNext) throw new Error("boom");
        },
      }),
    },
  },
} satisfies ModuleManifest;

async function emitOne(
  moduleId = "applicants",
  name = "applicants.application.accepted",
  payload?: unknown,
) {
  const db = getDb();
  const registry = buildRegistry([emitter, listener]);
  const personId = await createPerson({ email: `p${Math.random()}@example.test`, name: "P" });
  const emitted: string[] = [];
  await db.transaction(async (tx) => {
    const ctx = buildActionContext(tx, {
      db,
      registry,
      moduleId,
      actor: Actor.system(EDITION.id),
      edition: EDITION,
      now: new Date(),
      emitted,
    });
    await ctx.events.emit(
      name,
      payload ?? { v: 1, applicationId: personId, personId, editionId: EDITION.id },
    );
  });
  return { registry, emitted };
}

describe("domain events (outbox + dispatch)", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    calls = 0;
    failNext = false;
  });

  it("writes the event and one pending delivery per handler in the emitter's transaction", async () => {
    const { emitted } = await emitOne();
    const [event] = await getDb().select().from(domainEvents);
    expect(event!.id).toBe(emitted[0]);
    expect(event!.emittedByModule).toBe("applicants");
    const deliveries = await getDb().select().from(domainEventDeliveries);
    expect(deliveries.map((d) => [d.handlerModule, d.status])).toEqual([["content", "pending"]]);
  });

  it("refuses events without a contract, from the wrong module, or with a bad payload", async () => {
    await expect(emitOne("applicants", "applicants.nothing.happened")).rejects.toThrow(
      /no contract/,
    );
    await expect(emitOne("content")).rejects.toThrow(/can't emit/);
    await expect(
      emitOne("applicants", "applicants.application.accepted", { v: 1, applicationId: "nope" }),
    ).rejects.toThrow();
    expect(await getDb().select().from(domainEvents)).toHaveLength(0);
  });

  it("delivers once; a second dispatch is a no-op", async () => {
    const { registry } = await emitOne();
    expect(await dispatchEvents(getDb(), registry)).toEqual({ done: 1, skipped: 0, failed: 0 });
    expect(await dispatchEvents(getDb(), registry)).toEqual({ done: 0, skipped: 0, failed: 0 });
    expect(calls).toBe(1);
  });

  it("backs off on failure and stops after the max attempts", async () => {
    const { registry } = await emitOne();
    failNext = true;
    let now = new Date();
    for (let i = 0; i < MAX_DELIVERY_ATTEMPTS + 2; i++) {
      await dispatchEvents(getDb(), registry, { now });
      now = new Date(now.getTime() + 24 * 3600_000);
    }
    const [d] = await getDb().select().from(domainEventDeliveries);
    expect(d!.status).toBe("failed");
    expect(d!.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
    expect(d!.lastError).toBe("boom");
    expect(calls).toBe(MAX_DELIVERY_ATTEMPTS);
  });

  it("marks deliveries to a disabled module as skipped", async () => {
    const { registry } = await emitOne();
    process.env.MODULES_DISABLED = "content";
    try {
      expect(await dispatchEvents(getDb(), registry)).toEqual({ done: 0, skipped: 1, failed: 0 });
    } finally {
      process.env.MODULES_DISABLED = "";
    }
    const [d] = await getDb()
      .select()
      .from(domainEventDeliveries)
      .where(eq(domainEventDeliveries.handlerModule, "content"));
    expect(d!.status).toBe("skipped");
    expect(calls).toBe(0);
  });
});
