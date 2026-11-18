"use server";
// Approve (and import) or undo an import batch. Here because the tool-list importer writes this
// module's catalogue; base checks the caller is an admin again.
import { z } from "zod";
import { approveBatch, moduleAction, undoBatch, ValidationError } from "@/base/api";
import { toolImporter } from "./import-batch";

const importers = { tools: toolImporter };
const input = z.object({ id: z.string().uuid() });

async function run<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false as const, error: error.message };
    throw error;
  }
}

export const approveImportBatch = moduleAction(
  "procurement",
  { input, capability: "admin.settings" },
  (ctx, i) =>
    run(() =>
      approveBatch({ db: ctx.tx, actor: ctx.actor, edition: ctx.edition }, i.id, importers),
    ),
);

export const undoImportBatch = moduleAction(
  "procurement",
  { input, capability: "admin.settings" },
  (ctx, i) =>
    run(() => undoBatch({ db: ctx.tx, actor: ctx.actor, edition: ctx.edition }, i.id, importers)),
);
