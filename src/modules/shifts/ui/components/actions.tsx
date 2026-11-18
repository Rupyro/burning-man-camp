"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { claimShift, tickItem } from "../../server/actions";
import { dropShift, joinStandby, leaveStandby, takeStandby } from "../../server/standby";

function useRun() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        setMsg(done);
        router.refresh();
      } catch (e) {
        setMsg(
          e instanceof Error && e.name === "ValidationError"
            ? e.message
            : "That didn't work. You may not be allowed to do this.",
        );
      }
    });
  };
  return { msg, pending, run };
}

/** One tap to claim an open shift. */
export function ClaimButton({ slotId, label }: { slotId: string; label: string }) {
  const { msg, pending, run } = useRun();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        className="min-h-11"
        aria-label={`Claim ${label}`}
        onClick={() => run(() => claimShift({ slotId }), "You're on it. Thanks!")}
      >
        {pending ? "Claiming…" : "Claim"}
      </Button>
      {msg ? (
        <span role="status" className="text-sm">
          {msg}
        </span>
      ) : null}
    </span>
  );
}

/** A tickable checklist line for people on the shift. */
export function TickBox({
  slotId,
  itemId,
  text,
  ticked,
  canTick,
}: {
  slotId: string;
  itemId: string;
  text: string;
  ticked: boolean;
  canTick: boolean;
}) {
  const { msg, pending, run } = useRun();
  return (
    <label className="flex min-h-11 items-start gap-3 py-1">
      <input
        type="checkbox"
        className="mt-1 size-5"
        checked={ticked}
        disabled={!canTick || pending}
        onChange={(e) => {
          const next = e.target.checked;
          run(() => tickItem({ slotId, itemId, ticked: next }), next ? "Ticked." : "Unticked.");
        }}
      />
      <span>
        {text}
        {msg && msg !== "Ticked." && msg !== "Unticked." ? (
          <span role="status" className="block text-sm">
            {msg}
          </span>
        ) : null}
      </span>
    </label>
  );
}

type StandbyState = "on_shift" | "offered" | "waiting" | "full" | "none";

/** Drop a shift, wait on standby for a full one, or take or pass on an offered place. */
export function StandbyControls({
  slotId,
  state,
  offerText,
  place,
}: {
  slotId: string;
  state: StandbyState;
  offerText?: string;
  place?: number;
}) {
  const { msg, pending, run } = useRun();
  const status = msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
  if (state === "on_shift")
    return (
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          disabled={pending}
          className="min-h-11"
          onClick={() =>
            run(
              () => dropShift({ slotId }),
              "You're off this shift. The next person on standby will be offered it.",
            )
          }
        >
          I can't do this shift
        </Button>
        {status}
      </div>
    );
  if (state === "offered")
    return (
      <div className="rounded-xl border-l-4 border-primary bg-card p-3">
        <h2 className="heading text-sm">A shift is open for you</h2>
        {offerText ? <p className="mt-1 text-sm">{offerText}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={pending}
            className="min-h-11"
            onClick={() => run(() => takeStandby({ slotId }), "It's yours. Thanks!")}
          >
            Take the shift
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            className="min-h-11"
            onClick={() =>
              run(() => leaveStandby({ slotId }), "No problem. We'll ask the next person.")
            }
          >
            Not this time
          </Button>
        </div>
        {status}
      </div>
    );
  if (state === "waiting")
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          You're on standby{place ? ` (number ${place} in line)` : ""}. If a place opens up, it will
          be offered to you.
        </p>
        <Button
          variant="outline"
          disabled={pending}
          className="min-h-11"
          onClick={() => run(() => leaveStandby({ slotId }), "You're off standby.")}
        >
          Leave standby
        </Button>
        {status}
      </div>
    );
  if (state === "full")
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          This shift is full. Join standby and you'll be offered a place if someone drops out.
        </p>
        <Button
          disabled={pending}
          className="min-h-11"
          onClick={() => run(() => joinStandby({ slotId }), "You're on standby.")}
        >
          Join standby
        </Button>
        {status}
      </div>
    );
  return null;
}
