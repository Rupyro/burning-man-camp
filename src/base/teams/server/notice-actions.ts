"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { sessionAction } from "../../guard/module-action";
import { endNoticeNow, markNoticeRead, postNotice } from "../notices";

// Team notices. Refusals come back as { ok: false, code, error }.

export const postTeamNotice = sessionAction(
  {
    input: z.object({
      teamId: z.string().uuid(),
      body: z.string().max(280),
      endsAt: z.iso.datetime({ offset: true }),
    }),
  },
  async (ctx, input) => ({
    ok: true as const,
    data: await postNotice(
      { ...ctx, db: getDb() },
      { teamId: input.teamId, body: input.body, endsAt: new Date(input.endsAt) },
    ),
  }),
);

export const gotItTeamNotice = sessionAction(
  { input: z.object({ noticeId: z.string().uuid() }) },
  async (ctx, { noticeId }) => ({
    ok: true as const,
    data: await markNoticeRead({ ...ctx, db: getDb() }, noticeId),
  }),
);

export const endTeamNotice = sessionAction(
  { input: z.object({ noticeId: z.string().uuid() }) },
  async (ctx, { noticeId }) => ({
    ok: true as const,
    data: await endNoticeNow({ ...ctx, db: getDb() }, noticeId),
  }),
);
