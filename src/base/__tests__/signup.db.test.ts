// Sign up to apply (docs/specs/applicants.md §1): a new email becomes a prospect with a live invite;
// a known email changes nothing; the demo never writes.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { actorFor, createCamp, createPerson, getDb, truncateAll } from "@/base/api/testing-db";
import { canEmailSignIn, findPersonByEmail } from "@/base/auth/eligibility";
import { signUpApplicant } from "@/base/auth/signup";
import { editionMembers, people } from "@/base/schema";

const saved = process.env.DEMO_MODE;
afterEach(() => {
  if (saved === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = saved;
});

describe("sign up to apply", () => {
  beforeEach(async () => {
    delete process.env.DEMO_MODE;
    await truncateAll();
    await createCamp();
  });

  it("a new email becomes a prospect (an applicant) who can get a login link", async () => {
    expect(await signUpApplicant(getDb(), { name: " Rae New ", email: "Rae@Example.test" })).toBe(
      "created",
    );
    const person = await findPersonByEmail(getDb(), "rae@example.test");
    expect(person?.displayName).toBe("Rae New");
    const [m] = await getDb()
      .select()
      .from(editionMembers)
      .where(eq(editionMembers.personId, person?.id ?? ""));
    expect(m?.status).toBe("prospect");
    expect((await actorFor(person?.id ?? "")).isApplicant).toBe(true);
    expect(await canEmailSignIn(getDb(), "rae@example.test")).toBe(true);
  });

  it("a known email changes nothing (a member is never turned into an applicant)", async () => {
    const sam = await createPerson({ email: "sam@example.test", name: "Sam" });
    expect(await signUpApplicant(getDb(), { name: "Sam again", email: "sam@example.test" })).toBe(
      "exists",
    );
    expect((await actorFor(sam)).isConfirmedMember).toBe(true);
    expect(await getDb().select().from(people)).toHaveLength(1);
  });

  it("the demo never writes, and there's nothing to apply to without an edition", async () => {
    process.env.DEMO_MODE = "true";
    expect(await signUpApplicant(getDb(), { name: "Rae", email: "rae@gmail.com" })).toBe("demo");
    delete process.env.DEMO_MODE;
    await truncateAll();
    expect(await signUpApplicant(getDb(), { name: "Rae", email: "rae@gmail.com" })).toBe("closed");
    expect(await getDb().select().from(people)).toHaveLength(0);
  });
});
