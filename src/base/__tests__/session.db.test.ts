// The default request-context provider: reads the Better Auth session cookie on the server.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCamp, createPerson, EDITION, truncateAll } from "@/base/api/testing-db";
import { getAuth, resetAuthForTests } from "@/base/auth/auth";
import { createInvite } from "@/base/auth/invites";
import { Actor } from "@/base/authz/actor";
import { getDb } from "@/base/db/client";
import { sentEmails } from "@/base/email/adapter";
import { getRequestContext, setRequestContextProvider } from "@/base/guard/request";

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const origin = () => new Headers({ origin: "http://localhost:3000" });

async function signIn(email: string): Promise<string> {
  await getAuth().api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: origin() });
  const link = sentEmails()
    .filter((m) => m.tag === "auth.magic_link" && m.to === email)
    .at(-1)?.link;
  const token = new URL(link ?? "http://x").searchParams.get("token") ?? "";
  const { headers } = await getAuth().api.magicLinkVerify({
    query: { token },
    headers: origin(),
    returnHeaders: true,
  });
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("session request context", () => {
  beforeEach(async () => {
    await truncateAll();
    resetAuthForTests();
    setRequestContextProvider(undefined);
    await createCamp();
    requestHeaders = new Headers();
  });

  it("no cookie: no context", async () => {
    expect(await getRequestContext()).toBeNull();
  });

  it("a signed-in invited member resolves to their actor and edition", async () => {
    const invite = await createInvite(getDb(), {
      email: "member@example.test",
      displayName: "Member",
      editionId: EDITION.id,
      invitedBy: Actor.system(EDITION.id),
    });
    const cookie = await signIn("member@example.test");
    requestHeaders = new Headers({ cookie, "x-vercel-id": "req-42" });
    const rc = await getRequestContext();
    expect(rc?.actor.personId).toBe(invite.personId);
    expect(rc?.actor.isConfirmedMember).toBe(true);
    expect(rc?.edition.id).toBe(EDITION.id);
    expect(rc?.requestId).toBe("req-42");
  });

  it("a forged cookie resolves to nobody", async () => {
    await createPerson({ email: "x@example.test", name: "X" });
    requestHeaders = new Headers({ cookie: "better-auth.session_token=forged.value" });
    expect(await getRequestContext()).toBeNull();
  });
});
