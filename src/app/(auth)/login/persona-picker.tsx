"use client";
import { useState, useTransition } from "react";
import { PERSONAS } from "@/base/demo/personas";
import { demoSignIn } from "@/base/demo/server/actions";

/** Demo mode sign-in: one card per fake persona. Each click is a real session as that person. */
export function PersonaPicker() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pick = (persona: string) =>
    start(async () => {
      setError(null);
      const r = await demoSignIn({ persona });
      // A full page load follows the normal login link, which sets the session cookie.
      if (r.ok) window.location.assign(r.url);
      else setError(r.error);
    });
  return (
    <ul className="flex flex-col gap-3">
      {PERSONAS.map((p) => (
        <li key={p.key}>
          <button
            type="button"
            disabled={pending}
            onClick={() => pick(p.key)}
            data-persona={p.key}
            className="flex w-full flex-col items-start gap-1 rounded-2xl border bg-card p-4 text-left hover:border-primary"
          >
            <span className="heading text-sm">{p.label}</span>
            <span className="text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.blurb}</span>
          </button>
        </li>
      ))}
      {error ? (
        <li role="alert" className="text-sm text-destructive">
          {error}
        </li>
      ) : null}
    </ul>
  );
}
