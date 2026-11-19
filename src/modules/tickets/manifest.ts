import "server-only";
import type { ModuleManifest } from "@/base/api";
import { ticketsPermissions } from "./permissions";

/** Tickets and passes (plan Phase 3): who has a ticket, vehicle and early-arrival passes, Gate-ready. */
export const manifest = {
  id: "tickets",
  name: "Tickets and passes",
  description: "Your ticket, vehicle pass and early-arrival pass; the camp's Stewards board.",
  icon: "ticket",
  route: "/tickets",
  tablePrefix: "tickets_",
  access: [{ everyone: true }],
  permissions: ticketsPermissions.keys,
  nav: [{ label: "Tickets", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "tickets_status" }, { name: "tickets_allocations" }] },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
