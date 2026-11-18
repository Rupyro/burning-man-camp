"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";

export function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string, then?: (r: unknown) => void) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        setMsg(done);
        if (then) then(r);
        else router.refresh();
      } catch (e) {
        setMsg(
          e instanceof Error && e.name === "ValidationError"
            ? e.message
            : "That didn't work. Check the details, or you may not be allowed to do this.",
        );
      }
    });
  };
  return { msg, setMsg, pending, run, router };
}

export function Status({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
}

export function Form(props: {
  onSubmit: (f: FormData, submitter: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={props.className ?? "flex flex-col gap-2"}
      onSubmit={(e) => {
        e.preventDefault();
        const via = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        props.onSubmit(new FormData(e.currentTarget), via?.value ?? "");
      }}
    >
      {props.children}
    </form>
  );
}

export const field = "min-h-11";
export const select = "min-h-11 rounded-md border bg-card px-2";
export const area = "rounded-md border bg-card p-2";
export const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
