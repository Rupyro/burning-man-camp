// Tickets and passes (plan Phase 3): what each member has, and whether they're ready for the Gate.
// Pure rules, no database.

export const TICKET_STATES = ["none", "looking", "stewards_offered", "have"] as const;
export const PASS_STATES = ["not_needed", "need", "have"] as const;
export const EARLY_STATES = ["no", "requested", "have"] as const;
export type TicketState = (typeof TICKET_STATES)[number];
export type PassState = (typeof PASS_STATES)[number];
export type EarlyState = (typeof EARLY_STATES)[number];

export const TICKET_LABEL: Record<TicketState, string> = {
  none: "No ticket yet",
  looking: "Looking (sales, STEP or a friend)",
  stewards_offered: "Offered a Stewards ticket",
  have: "Have a ticket",
};
export const PASS_LABEL: Record<PassState, string> = {
  not_needed: "Not driving in",
  need: "Need a vehicle pass",
  have: "Have a vehicle pass",
};
export const EARLY_LABEL: Record<EarlyState, string> = {
  no: "Arriving when gates open",
  requested: "Asked for an early-arrival pass",
  have: "Have an early-arrival pass",
};

export interface TicketRow {
  ticket: TicketState;
  vehiclePass: PassState;
  earlyArrival: EarlyState;
}

/** What still stands between this person and the Gate. Empty = Gate-ready. */
export function gateMissing(r: TicketRow): string[] {
  const out: string[] = [];
  if (r.ticket !== "have") out.push("ticket");
  if (r.vehiclePass === "need") out.push("vehicle pass");
  if (r.earlyArrival === "requested") out.push("early-arrival pass");
  return out;
}

export interface Allocations {
  stewards: number;
  vehiclePasses: number;
  earlyPasses: number;
}

export interface Summary {
  people: number;
  gateReady: number;
  ticket: Record<TicketState, number>;
  stewardsLeft: number;
  vehiclePassesNeeded: number;
  earlyRequested: number;
  earlyLeft: number;
}

/** Counts for the lead's board, against what the event allocated. */
export function summarize(rows: readonly TicketRow[], a: Allocations): Summary {
  const ticket = Object.fromEntries(TICKET_STATES.map((s) => [s, 0])) as Record<
    TicketState,
    number
  >;
  for (const r of rows) ticket[r.ticket] += 1;
  const earlyHave = rows.filter((r) => r.earlyArrival === "have").length;
  return {
    people: rows.length,
    gateReady: rows.filter((r) => gateMissing(r).length === 0).length,
    ticket,
    stewardsLeft: Math.max(0, a.stewards - ticket.stewards_offered),
    vehiclePassesNeeded: rows.filter((r) => r.vehiclePass === "need").length,
    earlyRequested: rows.filter((r) => r.earlyArrival === "requested").length,
    earlyLeft: Math.max(0, a.earlyPasses - earlyHave),
  };
}
