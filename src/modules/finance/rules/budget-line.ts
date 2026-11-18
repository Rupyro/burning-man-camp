import { formatRand } from "./money";

/** The small line under a team's "left" figure: spent, approved, and the whole budget. */
export function budgetLine(row: {
  actualCents: number;
  committedCents: number;
  budgetCents: number;
}) {
  return `${formatRand(row.actualCents)} spent · ${formatRand(row.committedCents)} approved, not bought · of a ${formatRand(row.budgetCents)} budget`;
}
