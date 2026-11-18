// Pure: what a status change writes (spec T3, T4).
import type { TaskStatus } from "./risk";

/** A business-rule refusal. rules/ stays pure, so the engine turns this into a ValidationError. */
export class RuleError extends Error {
  constructor(
    message: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = "RuleError";
  }
}

export function statusPatch(
  before: { status: TaskStatus; completedAt: Date | null },
  next: TaskStatus,
  reason: string | null | undefined,
  now: Date,
): { status: TaskStatus; blockedReason: string | null; completedAt: Date | null } {
  const why = reason?.trim() ?? "";
  if (next === "blocked" && !why) {
    throw new RuleError("Say why it's blocked", "blockedReason");
  }
  return {
    status: next,
    blockedReason: next === "blocked" ? why : null,
    completedAt: next === "done" ? (before.completedAt ?? now) : null,
  };
}
