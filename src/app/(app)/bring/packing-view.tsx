"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { tickPacking } from "@/base/people/server/packing-actions";
import {
  CAMP_PROVIDES,
  PACKING_LIST,
  PACKING_SOURCES,
  PACKING_TOTAL,
  PLEASE_DONT_BRING,
  packedCount,
} from "@/lib/packing";

/** What to bring (my own tickable list) vs what the camp provides. */
export function PackingView({ ticked, tab }: { ticked: string[]; tab: "bring" | "provided" }) {
  const router = useRouter();
  const [on, setOn] = useState(() => new Set(ticked));
  const [, start] = useTransition();
  const toggle = (key: string) => {
    const next = !on.has(key);
    setOn((s) => {
      const c = new Set(s);
      if (next) c.add(key);
      else c.delete(key);
      return c;
    });
    start(async () => {
      await tickPacking({ key, on: next });
      router.refresh();
    });
  };
  const tabCls = (t: string) =>
    `flex-1 rounded-lg py-2 text-center text-sm font-bold ${tab === t ? "bg-card shadow" : "text-muted-foreground"}`;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">What to bring</h1>
        <p className="text-sm text-muted-foreground">Your own list. Tick things off as you pack.</p>
      </div>
      <nav className="flex rounded-xl bg-muted p-1" aria-label="What to bring">
        <Link href="/bring" className={tabCls("bring")}>
          I bring · {packedCount([...on])} of {PACKING_TOTAL}
        </Link>
        <Link href="/bring?tab=provided" className={tabCls("provided")}>
          Camp provides
        </Link>
      </nav>
      {tab === "bring" ? (
        PACKING_LIST.map((s) => (
          <section key={s.title} className="rounded-2xl border bg-card p-4">
            <h2 className="heading text-sm">{s.title}</h2>
            <ul className="mt-1">
              {s.items.map((i) => {
                const done = on.has(i.key);
                return (
                  <li key={i.key} className="border-b last:border-0">
                    <label className="flex min-h-11 w-full cursor-pointer items-start gap-3 py-2 text-left">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={done}
                        onChange={() => toggle(i.key)}
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 text-xs peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="text-sm">
                        <span className={done ? "text-muted-foreground line-through" : ""}>
                          {i.label}
                        </span>
                        {i.note ? (
                          <span className="block text-xs text-muted-foreground">{i.note}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      ) : (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="heading text-sm">
            The camp provides{" "}
            <span className="font-normal text-muted-foreground">(in your fee)</span>
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {CAMP_PROVIDES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        Please don't bring:{" "}
        {PLEASE_DONT_BRING.join(", ")
          .toLowerCase()
          .replace(/^./, (c) => c.toUpperCase())}
        .
        <br />
        {PACKING_SOURCES}
      </p>
    </div>
  );
}
