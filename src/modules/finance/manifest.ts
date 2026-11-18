import "server-only";
import type { ModuleManifest } from "@/base/api";
import { financePermissions } from "./permissions";
import { financeBadge, myFinanceItems } from "./server/my-items";

/** Budgets, spend requests, approvals, receipts and pay-backs (docs/specs/finance.md). */
export const manifest = {
  id: "finance",
  name: "Money",
  description: "Team budgets, asking to spend, approvals, receipts and pay-backs.",
  icon: "wallet",
  route: "/finance",
  tablePrefix: "finance_",
  access: [{ everyone: true }],
  permissions: financePermissions.keys,
  nav: [
    { label: "Money", path: "" },
    { label: "Request money", path: "new" },
    { label: "Camp fees", path: "fees", access: [{ capability: "finance.fees.manage" }] },
  ],
  tile: { order: 110, badge: financeBadge },
  myItems: myFinanceItems,
  jobs: [
    { id: "finance.reminders", schedule: "every_tick", run: () => import("./server/automations") },
  ],
  notificationTypes: [
    {
      key: "finance.approval_waiting",
      label: "Requests waiting for your decision",
      canMute: false,
    },
    { key: "finance.receipt_missing", label: "Receipts still to add", canMute: false },
  ],
  taskKinds: [{ key: "finance.purchase", label: "Buy it and add the receipt" }],
  events: {
    emits: ["finance.spend.decided", "finance.fee.created", "finance.fee.paid"],
    handles: {
      "procurement.need.purchase_requested": () => import("./server/handlers/purchase-requested"),
      "applicants.application.accepted": () => import("./server/handlers/application-accepted"),
    },
  },
  exports: {
    tables: [
      { name: "finance_budgets" },
      { name: "finance_approval_policies" },
      { name: "finance_spend_requests" },
      { name: "finance_policy_steps" },
      { name: "finance_request_steps" },
      { name: "finance_expenses" },
      { name: "finance_reimbursements" },
      { name: "finance_camp_fees" },
    ],
  },
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
