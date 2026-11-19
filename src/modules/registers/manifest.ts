import "server-only";
import type { ModuleManifest } from "@/base/api";
import { registersPermissions } from "./permissions";

/** Safety registers (plan Phases 6 and 8): fuel, flame effects, and stakes in and out. */
export const manifest = {
  id: "registers",
  name: "Registers",
  description: "Fuel stored, flame effects, and every stake in the ground.",
  icon: "clipboard",
  route: "/registers",
  tablePrefix: "registers_",
  access: [{ everyone: true }],
  permissions: registersPermissions.keys,
  nav: [{ label: "Registers", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "registers_items" }] },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
