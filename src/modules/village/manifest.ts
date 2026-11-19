import "server-only";
import type { ModuleManifest } from "@/base/api";
import { hasPack } from "@/lib/active-packs";
import { villagePermissions } from "./permissions";

/** Village or HUB pack (plan Phase 7): resources shared with partner camps. */
export const manifest = {
  id: "village",
  name: "Village",
  description: "What we lend to and borrow from partner camps, until it's all back home.",
  icon: "handshake",
  route: "/village",
  tablePrefix: "village_",
  access: [{ everyone: true }],
  permissions: villagePermissions.keys,
  nav: [{ label: "Village", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "village_shares" }] },
  flag: { defaultEnabled: hasPack("village") },
} satisfies ModuleManifest;
