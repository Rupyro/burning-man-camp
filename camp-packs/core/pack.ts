// Core: always on. The teams, roles and shifts every camp has. The event's own paperwork
// (deadlines and forms) lives in its event pack, camp-events/<event>/.
// Shift templates are keys into the definitions kept by the shifts module; a pack only
// switches them on.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "core",
  label: "Core",
  teams: [
    { key: "camp_infra", label: "Camp infrastructure" },
    { key: "gift_projects", label: "Gift projects" },
    { key: "logistics", label: "Logistics" },
    { key: "finance", label: "Finance" },
    { key: "kitchen", label: "Kitchen" },
    { key: "programming", label: "Programming" },
    { key: "community", label: "Community & membership" },
    { key: "duties", label: "Duties" },
    { key: "moop", label: "MOOP" },
    { key: "marketing", label: "Marketing & communications" },
    { key: "content", label: "Content creation" },
    { key: "knowledge", label: "Documentation & knowledge" },
  ],
  roles: [
    { key: "admin", label: "Admin", kind: "system" },
    { key: "camp_lead", label: "Camp lead", kind: "system" },
    { key: "pilot", label: "Pilot tester", kind: "system" },
    { key: "finance_approver", label: "Finance approver", kind: "capability" },
    {
      key: "kitchen_sensitive_viewer",
      label: "Sees diets and allergies by name",
      kind: "capability",
    },
    { key: "lnt_lead", label: "LNT lead", kind: "officer" },
    { key: "fire_safety_officer", label: "Fire safety officer", kind: "officer" },
    { key: "safety_officer", label: "Safety officer", kind: "officer" },
    { key: "information_officer", label: "Information officer", kind: "officer" },
  ],
  materialCategories: [
    { key: "tool", label: "Tool" },
    { key: "kitchen_equipment", label: "Kitchen gear" },
    { key: "building_material", label: "Building material" },
    { key: "electrical", label: "Electrical" },
    { key: "plumbing", label: "Plumbing and water" },
    { key: "safety", label: "Safety" },
    { key: "decor", label: "Decor" },
    { key: "consumable", label: "Consumable" },
    { key: "food", label: "Food" },
    { key: "camping", label: "Camping" },
    { key: "other", label: "Other" },
  ],
  // App sections: module ids (a module no pack brings is switched off) and home tiles.
  sections: [
    { key: "obligations", label: "Event deadlines" },
    { key: "finance", label: "Money" },
    { key: "procurement", label: "Gear and materials" },
    { key: "logistics", label: "Logistics" },
    { key: "applicants", label: "Joining" },
    { key: "shifts", label: "Shifts" },
    { key: "tile:rides", label: "Rides to camp tile" },
    { key: "tile:lnt-quiz", label: "Leave no trace quiz tile" },
  ],
  shiftTemplates: [
    { key: "kitchen_breakfast", label: "Breakfast Run" },
    { key: "kitchen_dinner", label: "Dinner Delight" },
    { key: "moop_early", label: "Early Birds MOOP" },
    { key: "moop_afternoon", label: "Afternoon Warriors MOOP" },
    { key: "build_crew", label: "Build crew" },
    { key: "strike_crew", label: "Strike crew" },
  ],
});
