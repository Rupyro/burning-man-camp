"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { recordFeePayment } from "../../server/fees";

export function RecordFeeButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        disabled={pending}
        aria-label={`Record payment (demo) for ${name}`}
        onClick={() =>
          start(async () => {
            try {
              const r = await recordFeePayment({ id });
              if (isActionFailure(r)) return setMsg(r.error);
              router.refresh();
            } catch {
              setMsg("That didn't work. You may not be allowed to do this.");
            }
          })
        }
      >
        {pending ? "Saving…" : "Record payment (demo)"}
      </Button>
      {msg ? (
        <span role="status" className="text-xs">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
