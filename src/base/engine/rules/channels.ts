// Pure: which channel a notification type uses for a person (spec N2).

export type Channel = "in_app" | "email_immediate" | "email_digest" | "off";

/** Base notification types people can set a preference for. Modules add theirs later. */
export const BASE_NOTIFICATION_TYPES = [
  "task.assigned",
  "claim.decided",
  "task.comment",
  "task.due_soon",
  "task.overdue",
  "task.unowned",
  "task.dependency_risk",
  "task.nudge",
] as const;

/** Assignments and claim decisions email at once; everything else waits for the daily digest. */
export const DEFAULT_CHANNELS: Readonly<Record<string, Channel>> = {
  "task.assigned": "email_immediate",
  "claim.decided": "email_immediate",
};
export const FALLBACK_CHANNEL: Channel = "email_digest";

/** A person's choice for this type, else their '*' choice, else the default. */
export function channelFor(
  type: string,
  prefs: readonly { type: string; channel: Channel }[],
): Channel {
  return (
    prefs.find((p) => p.type === type)?.channel ??
    prefs.find((p) => p.type === "*")?.channel ??
    DEFAULT_CHANNELS[type] ??
    FALLBACK_CHANNEL
  );
}
