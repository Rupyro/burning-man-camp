import "server-only";
import type { ModuleManifest } from "@/base/api";
import { hasPack } from "@/lib/active-packs";
import { mvPermissions } from "./permissions";

/** Mutant vehicle pack (plan Phase 7): the art car's driver roster. */
export const manifest = {
  id: "mv",
  name: "Art car drivers",
  description: "Who offers to drive the camp's mutant vehicle, and who's cleared.",
  icon: "car",
  route: "/mv",
  tablePrefix: "mv_",
  access: [{ everyone: true }],
  permissions: mvPermissions.keys,
  nav: [{ label: "Drivers", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "mv_drivers" }] },
  flag: { defaultEnabled: hasPack("mutant-vehicle") },
} satisfies ModuleManifest;
