"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { offerToDrive, setCleared } from "../../server/actions";

function useSave() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (isActionFailure(res)) setMsg(res.error);
        else {
          setMsg("Saved.");
          after?.();
          router.refresh();
        }
      } catch {
        setMsg("That didn't save. Please try again.");
      }
    });
  return { msg, pending, run };
}

export function OfferButton({ offered }: { offered: boolean }) {
  const { msg, pending, run } = useSave();
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={offered ? "outline" : "default"}
        className="min-h-11"
        disabled={pending}
        onClick={() => run(() => offerToDrive({ offer: !offered }))}
      >
        {offered ? "Withdraw my offer to drive" : "I can drive the art car"}
      </Button>
      {msg ? (
        <span role="status" className="text-sm">
          {msg}
        </span>
      ) : null}
    </div>
  );
}

export function ClearButton({ id, cleared }: { id: string; cleared: boolean }) {
  const { pending, run } = useSave();
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11"
      disabled={pending}
      onClick={() =>
        run(() =>
          setCleared({ id, cleared: !cleared, note: cleared ? "" : "License seen and briefed" }),
        )
      }
    >
      {cleared ? "Take back clearance" : "Clear to drive"}
    </Button>
  );
}
