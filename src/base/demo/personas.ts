// Demo mode personas (docs/specs/b3-demo-mode.md). Pure: safe to import anywhere.

/** Off unless DEMO_MODE is exactly "true". */
export function demoFlagOn(): boolean {
  return process.env.DEMO_MODE === "true";
}

export const PERSONAS = [
  {
    key: "new_applicant",
    email: "new-applicant@example.test",
    name: "Nia (demo new applicant)",
    label: "New applicant",
    blurb: "Just applied: see what happens next. Start here for the first-time experience.",
  },
  {
    key: "member",
    email: "member@example.test",
    name: "Sam (demo member)",
    label: "Member",
    blurb: "A camp member on the Kitchen team: my tasks, alerts, modules.",
  },
  {
    key: "kitchen_lead",
    email: "kitchen-lead@example.test",
    name: "Alex (demo Kitchen lead)",
    label: "Team lead",
    blurb: "Leads Kitchen: approves helpers, sees late and blocked work and readiness.",
  },
  {
    key: "diet_viewer",
    email: "diet@example.test",
    name: "Jo (demo diet viewer)",
    label: "Diet viewer",
    blurb: "A member who may see everyone's diets and allergies by name.",
  },
  {
    key: "finance_approver",
    email: "finance@example.test",
    name: "Jules (demo finance approver)",
    label: "Finance approver",
    blurb: "Leads Finance: approves spend requests and pays people back.",
  },
  {
    key: "applicant",
    email: "applicant@example.test",
    name: "Kai (demo applicant)",
    label: "Applicant",
    blurb: "Applying to join: status tracker, to-do list, documents and the application form.",
  },
  {
    key: "admin",
    email: "admin@example.test",
    name: "Admin (demo)",
    label: "Admin",
    blurb: "Runs the system: people, import, edition settings.",
  },
] as const;

export type PersonaKey = (typeof PERSONAS)[number]["key"];
export const DEMO_DOMAIN = "@example.test";
