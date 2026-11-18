"use client";
import { Gauge, X } from "lucide-react";
import { useRef } from "react";

/** Phone only (below lg): a tappable icon that opens the team readiness panel in a dialog. */
export function ReadinessDialog({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <span className="lg:hidden">
      <button
        type="button"
        aria-label="Team readiness"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="grid size-11 place-items-center rounded-full border bg-card text-card-foreground"
      >
        <Gauge aria-hidden className="size-5" />
      </button>
      <dialog
        ref={ref}
        aria-labelledby="readiness-dialog-title"
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border bg-card p-4 text-card-foreground backdrop:bg-black/50"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="readiness-dialog-title" className="heading text-sm">
            Team readiness
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="grid size-11 place-items-center rounded-full"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </dialog>
    </span>
  );
}
