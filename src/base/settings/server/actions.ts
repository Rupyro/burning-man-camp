"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { sessionAction } from "../../guard/module-action";
import { setAutomationSetting } from "../automation";

// Settings page. Refusals come back as { ok: false, code, error }.
export const saveAutomationSetting = sessionAction(
  {
    input: z.object({ key: z.string().max(40), value: z.number().int() }),
    capability: "admin.settings",
  },
  async (ctx, input) => ({
    ok: true as const,
    data: await setAutomationSetting({ ...ctx, db: getDb() }, input.key, input.value),
  }),
);
