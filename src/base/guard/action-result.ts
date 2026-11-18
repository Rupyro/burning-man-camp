// What a server action returns when it refuses: a plain object, because Next.js replaces the
// message of anything *thrown* from a server action with a generic one in production. Pure:
// safe to import from client components.

export type ActionFailureCode = "VALIDATION" | "FORBIDDEN" | "UNAUTHENTICATED";

export interface ActionFailure {
  ok: false;
  code: ActionFailureCode;
  /** Plain words for the person; safe to show as is. Same shape as `{ ok: false, error }` results. */
  error: string;
}

export function isActionFailure(r: unknown): r is ActionFailure {
  return (
    typeof r === "object" &&
    r !== null &&
    (r as { ok?: unknown }).ok === false &&
    typeof (r as { error?: unknown }).error === "string"
  );
}
