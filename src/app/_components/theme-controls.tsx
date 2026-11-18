"use client";
import { useEffect, useState } from "react";
import { parseMode, resolveTheme, THEME_KEY, type ThemeMode } from "@/lib/theme-mode";

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
];

function apply(night: boolean) {
  const c = document.documentElement.classList;
  c.toggle("theme-night", night);
  c.toggle("dark", night);
}

/** Auto (sunrise/sunset at Tankwa) / Day / Night, saved on this device. */
export function ThemeControls({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("auto");
  useEffect(() => setMode(parseMode(localStorage.getItem(THEME_KEY))), []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const r = resolveTheme(mode, Date.now());
      apply(r.night);
      if (r.nextChangeMs !== null) timer = setTimeout(tick, r.nextChangeMs + 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [mode]);
  const choose = (m: ThemeMode) => {
    if (m === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, m);
    setMode(m);
  };
  return (
    <fieldset className={`flex items-center gap-1 text-xs ${className}`}>
      <legend className="sr-only">Theme</legend>
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          aria-pressed={mode === m.value}
          onClick={() => choose(m.value)}
          className={`min-h-8 rounded-full border px-3 ${mode === m.value ? "bg-primary text-primary-foreground" : "bg-popover text-popover-foreground"}`}
        >
          {m.label}
        </button>
      ))}
    </fieldset>
  );
}
