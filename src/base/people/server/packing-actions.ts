"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { sessionAction } from "../../guard/module-action";
import { setMyPackingTick } from "../packing";

// What to bring: tick or untick one of my own packing-list items.
export const tickPacking = sessionAction(
  { input: z.object({ key: z.string().min(1).max(60), on: z.boolean() }) },
  async (ctx, { key, on }) => ({
    ok: true as const,
    data: await setMyPackingTick({ ...ctx, db: getDb() }, key, on),
  }),
);
