"use server";
import { z } from "zod";
import { ForbiddenError, moduleAction } from "@/base/api";
import { recordQuizPass } from "./quiz";

export const submitQuiz = moduleAction(
  "obligations",
  {
    input: z.object({ answers: z.array(z.number().int().min(0).max(9)).max(10) }),
    capability: "obligations.view",
  },
  async (ctx, input) => {
    const personId = ctx.actor.personId;
    if (!personId) throw new ForbiddenError();
    return { passed: await recordQuizPass(ctx.tx, ctx.edition.id, personId, input.answers) };
  },
);
