import "server-only";
import type { ModuleManifest } from "@/base/api";
import { shiftsPermissions } from "./permissions";
import { myShiftItems } from "./server/my-items";

/** Build, strike and camp duties (docs plan-shifts.md). Member screens: open shifts, claim, contribution, checklists. */
export const manifest = {
  id: "shifts",
  name: "Shifts",
  description: "Build, strike and camp duties: open shifts, your contribution, checklists.",
  icon: "calendar-clock",
  route: "/shifts",
  tablePrefix: "shifts_",
  access: [{ everyone: true }],
  permissions: shiftsPermissions.keys,
  nav: [{ label: "Shifts", path: "" }],
  myItems: myShiftItems,
  jobs: [
    { id: "shifts.standby", schedule: "every_tick", run: () => import("./server/standby-job") },
  ],
  notificationTypes: [
    { key: "shifts.standby_offer", label: "A shift is open for you", canMute: false },
    { key: "shifts.standby_took", label: "Someone took a dropped shift", canMute: true },
  ],
  events: { emits: [], handles: {} },
  exports: {
    tables: [
      { name: "shifts_settings" },
      { name: "shifts_duty_types" },
      { name: "shifts_checklist_items" },
      { name: "shifts_slots" },
      { name: "shifts_signups" },
      { name: "shifts_cover_requests" },
      { name: "shifts_checklist_ticks" },
      { name: "shifts_handovers" },
      { name: "shifts_handover_items" },
      { name: "shifts_precredits" },
      { name: "shifts_standby" },
    ],
  },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
