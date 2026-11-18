import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { actorFor, createCamp, createPerson, EDITION, truncateAll } from "@/base/api/testing-db";
import { getAuth, resetAuthForTests } from "@/base/auth/auth";
import { canEmailSignIn } from "@/base/auth/eligibility";
import { createInvite, findInviteByToken } from "@/base/auth/invites";
import { Actor } from "@/base/authz/actor";
import { getDb } from "@/base/db/client";
import { sentEmails } from "@/base/email/adapter";
import { ForbiddenError } from "@/base/errors";
import { loadActorForUser } from "@/base/people/actor-loader";
import { auditEvents, people, user } from "@/base/schema";

const headers = () => new Headers({ origin: "http://localhost:3000" });

async function requestLink(email: string) {
  await getAuth().api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: headers() });
  return sentEmails()
    .filter((m) => m.tag === "auth.magic_link" && m.to === email)
    .at(-1);
}

async function verify(link: string) {
  const token = new URL(link).searchParams.get("token") ?? "";
  return getAuth().api.magicLinkVerify({ query: { token }, headers: headers() });
}

const actions = async () => (await getDb().select().from(auditEvents)).map((a) => a.action);

describe("invite-only magic-link login", () => {
  beforeEach(async () => {
    await truncateAll();
    resetAuthForTests();
    await createCamp();
  });

  it("an invited email gets a link, logs in, is linked to their person, and both steps are audited", async () => {
    const invite = await createInvite(getDb(), {
      email: "Invited@Example.test",
      displayName: "Invited person",
      editionId: EDITION.id,
      invitedBy: Actor.system(EDITION.id),
    });
    expect(sentEmails().find((m) => m.tag === "auth.invite")?.link).toBe(invite.url);
    expect(await findInviteByToken(getDb(), invite.token)).not.toBeNull();

    const mail = await requestLink("invited@example.test");
    expect(mail?.link).toContain("/api/auth/magic-link/verify?token=");
    const result = await verify(mail!.link!);
    expect(result.session?.token).toBeTruthy();

    const [person] = await getDb().select().from(people).where(eq(people.id, invite.personId));
    expect(person!.userId).toBe(result.user.id);
    const resolved = await loadActorForUser(getDb(), result.user.id);
    expect(resolved?.actor.isConfirmedMember).toBe(true);

    expect(await actions()).toEqual(
      expect.arrayContaining(["invite.created", "invite.accepted", "auth.login"]),
    );
    const login = (await getDb().select().from(auditEvents)).find((a) => a.action === "auth.login");
    expect(login?.actorPersonId).toBe(invite.personId);
    expect(login?.significance).toBe("security");
  });

  it("an uninvited email gets no email, no user, and a refused-login audit row", async () => {
    expect(await canEmailSignIn(getDb(), "stranger@example.test")).toBe(false);
    const mail = await requestLink("stranger@example.test");
    expect(mail).toBeUndefined();
    expect(await getDb().select().from(user)).toHaveLength(0);
    const refused = (await getDb().select().from(auditEvents)).filter(
      (a) => a.action === "auth.login_refused",
    );
    expect(refused).toHaveLength(1);
    expect(JSON.stringify(refused[0])).not.toContain("stranger@");
  });

  it("a person without an invite (e.g. imported, not yet invited) is refused too", async () => {
    await createPerson({ email: "imported@example.test", name: "Imported" });
    expect(await canEmailSignIn(getDb(), "imported@example.test")).toBe(false);
    expect(await requestLink("imported@example.test")).toBeUndefined();
  });

  it("revoked or expired invites don't work", async () => {
    const invite = await createInvite(getDb(), {
      email: "late@example.test",
      displayName: "Late",
      editionId: EDITION.id,
      invitedBy: Actor.system(EDITION.id),
      now: new Date("2020-01-01T00:00:00Z"),
      sendEmail: false,
    });
    expect(await findInviteByToken(getDb(), invite.token)).toBeNull();
    expect(await canEmailSignIn(getDb(), "late@example.test")).toBe(false);
  });

  it("only admins (or the system) can invite", async () => {
    const memberId = await createPerson({ email: "m@example.test", name: "M" });
    const member = await actorFor(memberId);
    await expect(
      createInvite(getDb(), {
        email: "x@example.test",
        displayName: "X",
        editionId: EDITION.id,
        invitedBy: member,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
