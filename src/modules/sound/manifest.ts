import "server-only";
import type { ModuleManifest } from "@/base/api";
import { hasPack } from "@/lib/active-packs";
import { soundPermissions } from "./permissions";

/** Sound pack (plan Phase 6): the sound plan and the neighbor log. On when the camp has the Sound pack. */
export const manifest = {
  id: "sound",
  name: "Sound plan",
  description: "Quiet hours, the level limit, and a log of neighbors' visits and what we did.",
  icon: "speaker",
  route: "/sound",
  tablePrefix: "sound_",
  access: [{ everyone: true }],
  permissions: soundPermissions.keys,
  nav: [{ label: "Sound", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "sound_plans" }, { name: "sound_neighbor_log" }] },
  flag: { defaultEnabled: hasPack("sound") },
} satisfies ModuleManifest;
