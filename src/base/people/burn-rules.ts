// Pure: Burn Mode (Ruchir, Oct 28 2026). Each person switches it on themselves at camp; while on,
// home becomes the Burn pack and pre-Burn noise goes quiet for them. Nothing here touches the DB.
import { formatCampDay } from "@/lib/dates";

/** Pre-Burn noise that goes quiet: nudges, task alerts (incl. money to-dos), Money notices. */
const QUIET_TYPES = new Set([
  "task.nudge",
  "task.due_soon",
  "task.overdue",
  "task.unowned",
  "task.dependency_risk",
]);

/** True when a notice should not reach someone who has Burn Mode on. Shift changes still do. */
export function burnSilences(n: { type: string; href: string }): boolean {
  return QUIET_TYPES.has(n.type) || n.type.startsWith("finance.") || n.href.startsWith("/finance");
}

export interface BurnState {
  onAt: Date | null;
  arrivalAt: Date | null;
  promptDismissedAt: Date | null;
}

/**
 * C: the big welcome screen asks once, from the person's arrival day (camp time) or the first open
 * after it, until they answer or dismiss it. It never comes back after that.
 */
export function burnWelcome(s: BurnState, now: Date): boolean {
  if (s.onAt || !s.arrivalAt || s.promptDismissedAt) return false;
  return formatCampDay(now, "yyyy-MM-dd") >= formatCampDay(s.arrivalAt, "yyyy-MM-dd");
}

/** B: "Ask me on my arrival day" is on until the welcome is answered or the person turns it off. */
export function burnAskOn(s: BurnState): boolean {
  return !s.promptDismissedAt;
}
