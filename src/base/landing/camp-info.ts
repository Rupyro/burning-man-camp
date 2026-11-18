// Camp info page (docs/specs/b3-home-up-next.md §4): draft guide text and the lead contacts.

import type { DirectoryEntry } from "../people/directory";

export interface LeadContact {
  personId: string;
  name: string;
  team: string;
  role: "lead" | "co_lead";
}

/**
 * Team leads and co-leads from directory rows the caller may already see. Names and teams only;
 * contact details stay on the person's profile, which applies the contact rules.
 */
export function leadContacts(entries: readonly DirectoryEntry[]): LeadContact[] {
  const out: LeadContact[] = [];
  for (const e of entries)
    for (const t of e.teams)
      if (t.role === "lead" || t.role === "co_lead")
        out.push({ personId: e.personId, name: e.displayName, team: t.name, role: t.role });
  return out.sort(
    (a, b) =>
      a.team.localeCompare(b.team) ||
      (a.role === b.role ? 0 : a.role === "lead" ? -1 : 1) ||
      a.name.localeCompare(b.name),
  );
}

export { CAMP_GUIDE } from "@/lib/camp-content";
