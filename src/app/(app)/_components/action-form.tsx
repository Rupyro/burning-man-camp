"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Result = { ok: true } | { ok: false; error: string };

/** A small form that calls a server action with the values `read()` collects, then refreshes. */
export function ActionForm(props: {
  label: string;
  read: (form: FormData) => Promise<Result>;
  children: ReactNode;
  done?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setMessage(null);
        start(async () => {
          try {
            const r = await props.read(data);
            setMessage(r.ok ? (props.done ?? "Saved.") : r.error);
            if (r.ok) router.refresh();
          } catch {
            setMessage("You're not allowed to do that.");
          }
        });
      }}
    >
      {props.children}
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? "Working…" : props.label}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
