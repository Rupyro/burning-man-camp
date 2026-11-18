// Base tables exported read-only for module foreign keys (MODULE_RULEBOOK.md §5).
// Modules may reference these in .references() but must never write to them directly,
// and must not re-export them from their own schema.ts.
export {
  anchorDates,
  buildAreas,
  campSettings,
  editionMembers,
  editions,
  people,
  personSkills,
  roleAssignments,
  roles,
  skills,
  teamMemberships,
  teams,
} from "../schema/core";
export { projects, tasks } from "../schema/engine";
