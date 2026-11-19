"use server";
import { z } from "zod";
import { ForbiddenError, moduleAction } from "@/base/api";
import { EARLY_STATES, PASS_STATES, TICKET_STATES } from "../rules/gate";
import { ticketsAllocations, ticketsStatus } from "../schema";

export const saveMyTickets = moduleAction(
  "tickets",
  {
    input: z.object({
      ticket: z.enum(TICKET_STATES),
      vehiclePass: z.enum(PASS_STATES),
      earlyArrival: z.enum(EARLY_STATES),
      note: z.string().trim().max(200).nullable().optional(),
    }),
    capability: "tickets.view",
  },
  async (ctx, input) => {
    const personId = ctx.actor.personId;
    if (!personId) throw new ForbiddenError();
    const values = { ...input, note: input.note || null, updatedAt: ctx.now };
    await ctx.tx
      .insert(ticketsStatus)
      .values({ editionId: ctx.edition.id, personId, ...values })
      .onConflictDoUpdate({
        target: [ticketsStatus.editionId, ticketsStatus.personId],
        set: values,
      });
    return { ok: true as const };
  },
);

const count = z.number().int().min(0).max(500);

export const setAllocations = moduleAction(
  "tickets",
  {
    input: z.object({ stewards: count, vehiclePasses: count, earlyPasses: count }),
    capability: "tickets.manage",
  },
  async (ctx, input) => {
    await ctx.tx
      .insert(ticketsAllocations)
      .values({ editionId: ctx.edition.id, ...input, updatedAt: ctx.now })
      .onConflictDoUpdate({
        target: ticketsAllocations.editionId,
        set: { ...input, updatedAt: ctx.now },
      });
    await ctx.audit.record({
      action: "tickets.allocations.set",
      entity: { type: "tickets.allocations", id: ctx.edition.id },
      changes: { allocations: [null, input] },
      significance: "significant",
    });
    return { ok: true as const };
  },
);
