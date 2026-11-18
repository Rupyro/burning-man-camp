import "server-only";
import type { ModuleManifest } from "@/base/api";
import { procurementPermissions } from "./permissions";
import { myKitItems } from "./server/my-items";

/** Catalogue, stock by place, needs and "do we already have it?" (docs/specs/procurement.md). */
export const manifest = {
  id: "procurement",
  name: "Kit and stock",
  description: "What we own, where it is, what teams need, and what to buy.",
  icon: "package",
  route: "/procurement",
  tablePrefix: "procurement_",
  access: [{ everyone: true }],
  permissions: procurementPermissions.keys,
  nav: [
    { label: "Kit", path: "" },
    { label: "Raise a need", path: "new" },
    { label: "Ask the camp", path: "ask" },
    { label: "Write a message", path: "drafts" },
    { label: "Daily review", path: "review" },
  ],
  tile: { order: 120 },
  myItems: myKitItems,
  jobs: [
    {
      id: "procurement.reminders",
      schedule: "every_tick",
      run: () => import("./server/automations"),
    },
  ],
  notificationTypes: [
    { key: "procurement.unclaimed", label: "Kit nobody has picked up", canMute: true },
    {
      key: "procurement.not_bought",
      label: "Kit still not bought close to its date",
      canMute: false,
    },
  ],
  taskKinds: [
    { key: "procurement.buy", label: "Buy or borrow kit for the team" },
    { key: "procurement.ask", label: "Asked of the camp" },
  ],
  events: {
    emits: ["procurement.need.marked_critical", "procurement.need.purchase_requested"],
    handles: { "finance.spend.decided": () => import("./server/handlers/spend-decided") },
  },
  exports: {
    tables: [
      { name: "procurement_items" },
      { name: "procurement_locations" },
      { name: "procurement_stock" },
      { name: "procurement_stock_movements" },
      { name: "procurement_suppliers", sensitiveColumns: ["contact_phone"] },
      { name: "procurement_needs" },
      { name: "procurement_ask_log" },
      { name: "procurement_drafts" },
      { name: "procurement_draft_log" },
    ],
  },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
