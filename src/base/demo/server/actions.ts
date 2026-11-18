"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { ForbiddenError } from "../../errors";
import { publicAction } from "../../guard/module-action";
import { demoLinkFor } from "../sign-in";

/**
 * Demo persona picker (spec b3-demo-mode §2). Public like the login form: there is no caller yet.
 * Refused (not found) unless demo mode is on for this database.
 */
export const demoSignIn = publicAction(
  { input: z.object({ persona: z.string().max(40) }) },
  async ({ persona }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    try {
      const url = await demoLinkFor(persona, await headers());
      return url ? { ok: true, url } : { ok: false, error: "Unknown persona" };
    } catch (error) {
      if (error instanceof ForbiddenError) return { ok: false, error: "Demo mode is off" };
      throw error;
    }
  },
);
