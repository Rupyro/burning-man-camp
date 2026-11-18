import "server-only";
import type { ModuleManifest } from "@/base/api";
import { applicantsPermissions } from "./permissions";
import { familyYearsOf } from "./server/family-years";
import { myApplicantItems } from "./server/my-items";

/** Applying to join, and Open applications for leads (docs/specs/applicants.md). */
export const manifest = {
  id: "applicants",
  name: "Applications",
  description: "Apply to join the camp, or review open applications.",
  icon: "user-plus",
  route: "/apply",
  tablePrefix: "applicant_",
  access: [
    { capability: "applicants.apply" },
    { capability: "applicants.review" },
    { capability: "applicants.welcome" },
  ],
  permissions: applicantsPermissions.keys,
  nav: [
    { label: "My application", path: "", access: [{ capability: "applicants.apply" }] },
    { label: "Application form", path: "form", access: [{ capability: "applicants.apply" }] },
    { label: "Open applications", path: "review", access: [{ capability: "applicants.review" }] },
    { label: "Welcoming family", path: "family", access: [{ capability: "applicants.review" }] },
  ],
  tile: { order: 105 },
  myItems: myApplicantItems,
  funYears: familyYearsOf,
  jobs: [
    {
      id: "applicants.reminders",
      schedule: "every_tick",
      run: () => import("./server/automations"),
    },
  ],
  notificationTypes: [
    { key: "applicants.fee_unpaid", label: "Camp fee still to pay", canMute: false },
    { key: "applicants.requirement_missing", label: "Still needed to join", canMute: false },
    { key: "applicants.review_waiting", label: "Applications waiting for a review", canMute: true },
  ],
  events: {
    emits: ["applicants.application.accepted"],
    handles: {
      "finance.fee.created": () => import("./server/handlers/fee-created"),
      "finance.fee.paid": () => import("./server/handlers/fee-paid"),
    },
  },
  exports: {
    tables: [
      { name: "applicant_applications", sensitiveColumns: ["answers", "lead_note"] },
      { name: "applicant_documents" },
      { name: "applicant_family_years" },
      { name: "applicant_family_answers", sensitiveColumns: ["anything_else"] },
      { name: "applicant_family_approvals", sensitiveColumns: ["note"] },
    ],
  },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
