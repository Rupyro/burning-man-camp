import "server-only";
import type { ModuleManifest } from "@/base/api";
import { hasPack } from "@/lib/active-packs";
import { schedulePermissions } from "./permissions";

/** Workshops and Offerings pack (plan Phase 7): the camp's event schedule and its guide export. */
export const manifest = {
  id: "schedule",
  name: "Schedule",
  description: "What the camp offers and when: classes, meals, parties, rituals.",
  icon: "calendar",
  route: "/schedule",
  tablePrefix: "schedule_",
  access: [{ everyone: true }],
  permissions: schedulePermissions.keys,
  nav: [{ label: "Schedule", path: "" }],
  events: { emits: [], handles: {} },
  exports: { tables: [{ name: "schedule_events" }] },
  flag: { defaultEnabled: hasPack("workshops") },
} satisfies ModuleManifest;
