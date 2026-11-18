"use server";
// The two CSV exports (L5, L7). Logged, because they carry names and emails.
import { z } from "zod";
import { moduleAction } from "@/base/api";
import { arrivalsCsv, wapCsv } from "../rules/exports";
import { membersFor } from "./members";

export const exportCsv = moduleAction(
  "logistics",
  { input: z.object({ kind: z.enum(["wap", "arrivals"]) }), capability: "logistics.export" },
  async (ctx, input) => {
    const rows = await membersFor(ctx.tx, ctx.edition.id);
    const csv = input.kind === "wap" ? wapCsv(rows) : arrivalsCsv(rows);
    await ctx.audit.record({
      action: `logistics.export.${input.kind}`,
      entity: { type: "logistics.export", id: ctx.edition.id },
      changes: { rows: [null, csv.split("\n").length - 1] },
      significance: "security",
    });
    const name = input.kind === "wap" ? "wap-builders" : "arrivals";
    return { ok: true as const, filename: `${name}-${ctx.edition.year}.csv`, csv };
  },
);
