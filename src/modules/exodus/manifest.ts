import "server-only";
import type { ModuleManifest } from "@/base/api";
import { exodusPermissions } from "./permissions";

/** Exodus (plan Phase 8): departure schedule and the final sweep crew. */
export const manifest = {
  id: "exodus",
  name: "Exodus",
  description: "Who leaves when, and who stays for the final sweep.",
  icon: "log-out",
  route: "/exodus",
  tablePrefix: "exodus_",
  access: [{ everyone: true }],
  permissions: exodusPermissions.keys,
  nav: [{ label: "Exodus", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "exodus_departures" }] },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
