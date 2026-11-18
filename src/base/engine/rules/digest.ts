// Pure: the daily digest email for one person (spec N4).
import { CAMP_NAME } from "@/lib/camp";

export const DIGEST_HOUR_LOCAL = 7;

const GROUPS: Readonly<Record<string, string>> = {
  "task.overdue": "Overdue",
  "task.stalled": "Gone quiet",
  "task.due_soon": "Due soon",
  "task.unowned": "Needs an owner",
  "task.dependency_risk": "At risk",
  "task.assigned": "Assigned to you",
  "claim.decided": "Claims",
  "task.comment": "New comments",
  "task.nudge": "Nudges from your lead",
};

export interface DigestItem {
  type: string;
  title: string;
  href: string;
}

/** One email: a line per notification, grouped by type in a fixed order, unknown types last. */
export function buildDigest(items: readonly DigestItem[], baseUrl: string) {
  const order = Object.keys(GROUPS);
  const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length);
  const types = [...new Set(items.map((i) => i.type))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
  const sections = types.map((type) => {
    const lines = items
      .filter((i) => i.type === type)
      .map((i) => `- ${i.title}\n  ${baseUrl}${i.href}`);
    return `${GROUPS[type] ?? "Other"}\n${lines.join("\n")}`;
  });
  const n = items.length;
  return {
    subject: `${CAMP_NAME}: ${n} ${n === 1 ? "update" : "updates"}`,
    text: `${sections.join("\n\n")}\n\nChange what you get by email: ${baseUrl}/notifications`,
  };
}
