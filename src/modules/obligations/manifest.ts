import "server-only";
import type { ModuleManifest } from "@/base/api";
import { obligationsPermissions } from "./permissions";
import { myObligations, obligationsBadge } from "./server/my-items";

/** AfrikaBurn deadlines the camp owes (docs/specs/obligations.md). */
export const manifest = {
  id: "obligations",
  name: "AfrikaBurn deadlines",
  description: "What the camp owes AfrikaBurn and others, by when, and who's on it.",
  icon: "calendar-check",
  route: "/obligations",
  tablePrefix: "obligation_",
  access: [{ everyone: true }],
  permissions: obligationsPermissions.keys,
  nav: [
    { label: "Deadlines", path: "" },
    { label: "Leave no trace quiz", path: "quiz" },
  ],
  tile: { order: 100, badge: obligationsBadge },
  myItems: myObligations,
  jobs: [
    {
      id: "obligations.reminders",
      schedule: "every_tick",
      run: () => import("./server/automations"),
    },
  ],
  notificationTypes: [
    { key: "obligations.deadline", label: "AfrikaBurn deadlines coming up", canMute: false },
  ],
  taskKinds: [
    {
      key: "obligations.obligation",
      label: "AfrikaBurn obligation",
      escalateOverdueImmediately: true,
      // Rule 15's 30/14/7/2-day reminders replace the base 3- and 1-day due-soon alerts.
      ownDueSoonReminders: true,
    },
  ],
  events: { emits: ["obligations.obligation.submitted"] },
  exports: { tables: [{ name: "obligation_details" }] },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
