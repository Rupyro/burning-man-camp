"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askBurnMode, notYetBurnMode, switchBurnMode } from "@/base/people/server/burn-actions";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold";
type Act = () => Promise<{ ok: boolean; error?: string }>;

function useBurnAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: Act, to?: string) =>
    start(async () => {
      setError(null);
      const r = await fn().catch(() => ({ ok: false, error: "No signal? Try again." }));
      if (!r.ok) return setError(r.error ?? "Couldn't change Burn Mode.");
      if (to) router.push(to);
      router.refresh();
    });
  const err = error ? (
    <span role="alert" className="w-full text-xs text-destructive">
      {error}
    </span>
  ) : null;
  return { act, pending, err };
}

/** C: the two answers on the arrival-day welcome screen. Either one means it won't ask again. */
export function BurnWelcomeButtons() {
  const { act, pending, err } = useBurnAct();
  return (
    <span className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => act(() => switchBurnMode({ on: true }), "/shifts/pack")}
        className={`${btn} bg-primary text-primary-foreground`}
      >
        {pending ? "…" : "Yes, Burn Mode"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act(() => notYetBurnMode({}), "/")}
        className="min-h-11 text-sm underline"
      >
        Not now (it's in My profile)
      </button>
      {err}
    </span>
  );
}

function Toggle({
  on,
  label,
  disabled,
  onClick,
}: {
  on: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        aria-hidden
        className={`relative inline-block h-7 w-12 shrink-0 rounded-full border-2 ${on ? "bg-primary" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-card shadow ${on ? "right-0.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/** B: the permanent switches in My profile. Only ever the caller's own row. */
export function BurnProfileSwitches({
  on,
  ask,
  arrival,
}: {
  on: boolean;
  ask: boolean;
  arrival: string | null;
}) {
  const { act, pending, err } = useBurnAct();
  return (
    <span className="flex flex-col gap-1">
      <Toggle
        on={on}
        label="Burn Mode"
        disabled={pending}
        onClick={() => act(() => switchBurnMode({ on: !on }))}
      />
      {arrival && !on ? (
        <Toggle
          on={ask}
          label={`Ask me on my arrival day (${arrival})`}
          disabled={pending}
          onClick={() => act(() => askBurnMode({ ask: !ask }))}
        />
      ) : null}
      {err}
    </span>
  );
}

/** B: the slim tag on every page while Burn Mode is on. One tap switches it off. */
export function BurnTag() {
  const { act, pending, err } = useBurnAct();
  return (
    <span className="mb-3 flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => act(() => switchBurnMode({ on: false }), "/")}
        className="burn-tag min-h-8 rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
      >
        {pending ? "…" : "🔥 Burn Mode · quiet · tap to switch off"}
      </button>
      {err}
    </span>
  );
}
