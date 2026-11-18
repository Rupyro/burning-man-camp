import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  baseTables,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { createAuditApi, recordAudit } from "@/base/audit/audit";
import { Actor } from "@/base/authz/actor";

const entity = { type: "base.thing", id: "01900000-0000-7000-8000-00000000beef" };
const rows = () => getDb().select().from(baseTables.auditEvents);

describe("audit log", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("records a person actor with their edition, defaults and request id", async () => {
    const personId = await createPerson({ email: "m@example.test", name: "M" });
    const actor = await actorFor(personId);
    await createAuditApi(getDb(), { actor, requestId: "req-1" }).record({
      action: "base.thing.changed",
      entity,
      changes: { name: ["a", "b"] },
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      actorKind: "person",
      actorPersonId: personId,
      editionId: EDITION.id,
      action: "base.thing.changed",
      entityType: "base.thing",
      entityId: entity.id,
      changes: { name: ["a", "b"] },
      significance: "activity",
      requestId: "req-1",
    });
  });

  it("records system and anonymous actors as system with nulls", async () => {
    await recordAudit(getDb(), { actor: Actor.system() }, { action: "a.sys", entity });
    await recordAudit(getDb(), { actor: null }, { action: "a.anon", entity });
    const all = await rows();
    for (const row of all) {
      expect(row).toMatchObject({
        actorKind: "system",
        actorPersonId: null,
        editionId: null,
        changes: null,
        requestId: null,
      });
    }
    expect(all.map((r) => r.action).sort()).toEqual(["a.anon", "a.sys"]);
  });

  it("explicit meta wins over the actor (auth hooks, imports)", async () => {
    const personId = await createPerson({ email: "m@example.test", name: "M" });
    await recordAudit(
      getDb(),
      { actor: null, actorKind: "import", actorPersonId: personId, editionId: EDITION.id },
      { action: "a.import", entity, significance: "security" },
    );
    const [row] = await rows();
    expect(row).toMatchObject({
      actorKind: "import",
      actorPersonId: personId,
      editionId: EDITION.id,
      significance: "security",
    });
  });
});
