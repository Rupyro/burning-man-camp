import "server-only";
import type { ModuleManifest } from "@/base/api";
import { logisticsPermissions } from "./permissions";
import { myLogisticsItems } from "./server/my-items";

/** Loads, critical kit, members' travel and rides, WAP list (docs/specs/logistics.md). */
export const manifest = {
  id: "logistics",
  name: "Travel and loads",
  description: "Your travel and rides; loads, critical kit and arrival lists for leads.",
  icon: "truck",
  route: "/logistics",
  tablePrefix: "logistics_",
  access: [{ everyone: true }],
  permissions: logisticsPermissions.keys,
  nav: [
    { label: "Travel and loads", path: "" },
    { label: "Rides to camp", path: "rides" },
  ],
  tile: { order: 130 },
  myItems: myLogisticsItems,
  events: {
    emits: [],
    handles: {
      "procurement.need.marked_critical": () => import("./server/handlers/need-critical"),
    },
  },
  exports: {
    tables: [
      { name: "logistics_places" },
      { name: "logistics_vehicles" },
      { name: "logistics_loads" },
      { name: "logistics_load_items" },
      { name: "logistics_travel_plans" },
      { name: "logistics_ride_matches" },
    ],
  },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
