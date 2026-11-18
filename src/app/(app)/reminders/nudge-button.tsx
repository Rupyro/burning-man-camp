"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { nudge } from "@/base/engine/server/actions";
import { Button } from "@/components/ui/button";

/** One tap: send this person one alert about their late tasks in the team. */
export function NudgeButton(p: { teamId: string; personId: string; name: string; late: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        className="min-h-11"
        disabled={pending}
        aria-label={`Nudge ${p.name} about ${p.late} late`}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await nudge({ teamId: p.teamId, personId: p.personId });
            if (isActionFailure(r)) return setMsg(r.error);
            setMsg("Nudged.");
            router.refresh();
          })
        }
      >
        {pending ? "Nudging…" : `Nudge about ${p.late} late`}
      </Button>
      {msg ? (
        <span role="status" className="text-xs">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
