"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { sessionAction } from "../../guard/module-action";
import { dismissMyBurnPrompt, setMyBurnAsk, setMyBurnMode } from "../burn-mode";

// Burn Mode: only ever the caller's own row. Refusals come back as { ok: false, code, error }.

export const switchBurnMode = sessionAction(
  { input: z.object({ on: z.boolean() }) },
  async (ctx, { on }) => ({
    ok: true as const,
    data: await setMyBurnMode({ ...ctx, db: getDb() }, on),
  }),
);

export const notYetBurnMode = sessionAction({ input: z.object({}) }, async (ctx) => ({
  ok: true as const,
  data: await dismissMyBurnPrompt({ ...ctx, db: getDb() }),
}));

export const askBurnMode = sessionAction(
  { input: z.object({ ask: z.boolean() }) },
  async (ctx, { ask }) => ({
    ok: true as const,
    data: await setMyBurnAsk({ ...ctx, db: getDb() }, ask),
  }),
);
