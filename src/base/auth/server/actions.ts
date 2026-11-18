"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "../../db/client";
import { publicAction, sessionAction } from "../../guard/module-action";
import { getAuth } from "../auth";
import { findInviteByToken } from "../invites";
import { signUpApplicant } from "../signup";

const LOGIN_RESPONSE = {
  ok: true as const,
  message: "If that email is invited, a login link is on its way.",
};

/** Always answers the same way, so nobody can probe which emails are invited. */
export const requestLoginLink = publicAction(
  { input: z.object({ email: z.string().trim().email().max(200) }) },
  async ({ email }) => {
    await getAuth().api.signInMagicLink({
      body: { email, callbackURL: "/", errorCallbackURL: "/login" },
      headers: await headers(),
    });
    return LOGIN_RESPONSE;
  },
);

/** Sign up to apply (spec applicants §1). Same answer whether or not the email was known. */
export const signUp = publicAction(
  {
    input: z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(200),
    }),
  },
  async ({ name, email }) => {
    const outcome = await signUpApplicant(getDb(), { name, email });
    if (outcome === "demo")
      return {
        ok: false as const,
        message: "Sign-up is switched off in the demo. Use the Applicant card on the sign-in page.",
      };
    if (outcome === "closed")
      return { ok: false as const, message: "Applications aren't open yet. Check back soon." };
    await getAuth().api.signInMagicLink({
      body: { email, callbackURL: "/", errorCallbackURL: "/login" },
      headers: await headers(),
    });
    return {
      ok: true as const,
      message: "Thanks! If you can apply with that email, a login link is on its way.",
    };
  },
);

export const sendInviteLoginLink = publicAction(
  { input: z.object({ token: z.string().min(20).max(200) }) },
  async ({ token }) => {
    const found = await findInviteByToken(getDb(), token);
    if (!found)
      return { ok: false as const, message: "This invite link is invalid or has expired." };
    await getAuth().api.signInMagicLink({
      body: { email: found.person.email, callbackURL: "/", errorCallbackURL: "/login" },
      headers: await headers(),
    });
    return { ok: true as const, message: `Login link sent to ${found.person.email}.` };
  },
);

export const signOut = sessionAction({ input: z.object({}) }, async () => {
  await getAuth().api.signOut({ headers: await headers() });
  return { ok: true as const };
});
