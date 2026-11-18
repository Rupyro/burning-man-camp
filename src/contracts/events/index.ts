import type { z } from "zod";
import { applicantsEvents } from "./applicants";
import { financeEvents } from "./finance";
import { obligationsEvents } from "./obligations";
import { procurementEvents } from "./procurement";

/** Every event contract, by name. Add a module's contract map here when it starts emitting. */
export const eventContracts = {
  ...obligationsEvents,
  ...financeEvents,
  ...procurementEvents,
  ...applicantsEvents,
} as const;

export type EventName = keyof typeof eventContracts;
export type EventPayload<N extends EventName> = z.infer<(typeof eventContracts)[N]>;
