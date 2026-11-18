"use client";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { sendInviteLoginLink } from "@/base/auth/server/actions";
import { Button } from "@/components/ui/button";

export function InviteButton({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button
        className="min-h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await sendInviteLoginLink({ token });
            setMessage(isActionFailure(res) ? res.error : res.message);
          })
        }
      >
        {pending ? "Sending…" : "Email me my login link"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
