"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { ValidationError } from "../../errors";
import { sessionAction } from "../../guard/module-action";
import { createBatch, decideRow } from "../batches";

// Import review screens (admins only; each service call checks isAdmin again).
async function run<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false as const, error: error.message };
    throw error;
  }
}

export const uploadBatch = sessionAction(
  {
    input: z.object({
      kind: z.enum(["members", "tools", "family"]),
      fileName: z.string().max(200),
      csv: z.string().max(2_000_000),
    }),
    capability: "admin.settings",
  },
  (ctx, i) => run(() => createBatch({ ...ctx, db: getDb() }, i)),
);

export const decideBatchRow = sessionAction(
  {
    input: z.object({
      rowId: z.string().uuid(),
      decision: z.enum(["accept", "fix", "skip"]),
      fix: z.record(z.string().max(40), z.string().max(500)).optional(),
      setResponsible: z.boolean().optional(),
    }),
    capability: "admin.settings",
  },
  (ctx, i) => run(() => decideRow({ ...ctx, db: getDb() }, i)),
);
