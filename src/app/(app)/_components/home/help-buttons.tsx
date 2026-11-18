"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideTaskClaim } from "@/base/engine/server/actions";

/** Accept / Decline an offer to help. The server re-checks that I may manage the task. */
export function HelpButtons({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      try {
        const r = await decideTaskClaim({ assignmentId, approve });
        if (r.ok) router.refresh();
        else setError(r.error);
      } catch {
        setError("You're not allowed to do that.");
      }
    });
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(true)}
          className="min-h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(false)}
          className="min-h-9 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
        >
          Decline
        </button>
      </span>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
