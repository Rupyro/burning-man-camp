// Claiming through the action: one tap, qualified only, never over capacity, filled when full.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/base/api";
import { personSkills, skills } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import {
  actAs,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { shiftsDutyTypes, shiftsSettings, shiftsSignups, shiftsSlots } from "../schema";
import { claimShift } from "../server/actions";

const later = (days: number) => new Date(Date.now() + days * 86_400_000);
let a: string;
let b: string;

async function slot(extra: Partial<typeof shiftsDutyTypes.$inferInsert> = {}) {
  const [d] = await getDb()
    .insert(shiftsDutyTypes)
    .values({
      editionId: EDITION.id,
      key: `k${Math.random()}`,
      name: "K",
      category: "kitchen",
      maxStaff: 1,
      ...extra,
    })
    .returning();
  const [s] = await getDb()
    .insert(shiftsSlots)
    .values({
      editionId: EDITION.id,
      dutyTypeId: d?.id ?? "",
      startsAt: later(30),
      endsAt: later(30.1),
    })
    .returning();
  return s?.id ?? "";
}

describe("claim a shift", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    a = await createPerson({ email: "a@example.test", name: "A" });
    b = await createPerson({ email: "b@example.test", name: "B" });
    await getDb()
      .insert(shiftsSettings)
      .values({ editionId: EDITION.id, freezeAt: later(20) });
  });

  it("claims, marks the shift filled, and refuses the next person", async () => {
    const s = await slot();
    await actAs(a);
    await ok(claimShift({ slotId: s }));
    const [row] = await getDb().select().from(shiftsSlots).where(eq(shiftsSlots.id, s));
    expect(row?.status).toBe("filled");
    await actAs(b);
    await expect(ok(claimShift({ slotId: s }))).rejects.toBeInstanceOf(ValidationError);
    expect(await getDb().select().from(shiftsSignups)).toHaveLength(1);
  });

  it("qualified only", async () => {
    const [sk] = await getDb()
      .insert(skills)
      .values({ key: "driving_x", label: "Driving" })
      .returning();
    const s = await slot({ isSpecialist: true, requiredSkillId: sk?.id ?? null });
    await actAs(a);
    await expect(ok(claimShift({ slotId: s }))).rejects.toBeInstanceOf(ValidationError);
    await getDb()
      .insert(personSkills)
      .values({ personId: a, skillId: sk?.id ?? "" });
    await ok(claimShift({ slotId: s }));
  });

  it("frozen: no self sign-up", async () => {
    await getDb()
      .update(shiftsSettings)
      .set({ freezeAt: later(-1) });
    const s = await slot();
    await actAs(a);
    await expect(ok(claimShift({ slotId: s }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("an overlap comes back as a readable failure, not a thrown error", async () => {
    const first = await slot({ maxStaff: 3 });
    const second = await slot({ maxStaff: 3 });
    await actAs(a);
    await ok(claimShift({ slotId: first }));
    expect(await claimShift({ slotId: second })).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "It overlaps another of your shifts",
    });
  });
});
