"use client";
import { useEffect, useRef, useState } from "react";
import { Emblem } from "@/lib/emblem";
import {
  BADGES,
  badgeClass,
  badgeLabel,
  badgeRow,
  badgeRowTop,
  dropSlotX,
  dropTarget,
  FUN_CHANGE,
  FUN_KEY,
  flipFun,
  funActive,
  funEnabled,
  funPlan,
  isShake,
  isSleepHour,
  milestoneText,
  revealPlaya,
  stormAllowed,
  TapCounter,
} from "@/lib/fun-extras";
import { GUST_NOW } from "./dust-gust";

/** Hundreds of tiny people around the fire, seen from above (fixed positions, no randomness). */
const DOTS = Array.from({ length: 240 }, (_, i) => ({
  id: `p${i}`,
  style: {
    "--a": `${(i * 137.5) % 360}deg`,
    "--r": `${40 + (i % 5) * 22}px`,
    animationDuration: `${2.2 + (i % 3) * 0.4}s`,
  } as React.CSSProperties,
}));

const SEEN_KEY = "oe-fun-done";
const BADGES_KEY = "oe-fun-badges";

function useFun() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setOn(funActive(localStorage.getItem(FUN_KEY), reduced.matches));
    read();
    window.addEventListener(FUN_CHANGE, read);
    reduced.addEventListener("change", read);
    return () => {
      window.removeEventListener(FUN_CHANGE, read);
      reduced.removeEventListener("change", read);
    };
  }, []);
  return on;
}

/** Self-drawn badge pictograms (simple SVG, no outside artwork). */
function BadgeIcon({ id }: { id: string }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
  };
  const shape: Record<string, React.ReactNode> = {
    "first-shift": (
      <path {...p} d="M12 4c3 4 4 6 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" />
    ),
    "tasks-10": <path {...p} d="M6 12l4 4 8-8" />,
    "tasks-50": (
      <path {...p} d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16l-5 3 1.2-5.6L4 9.6 9.6 9z" />
    ),
    "tasks-100": (
      <path {...p} d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
    ),
    "first-thanks": (
      <path {...p} d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 4.6-7 9-7 9z" />
    ),
    strike: <path {...p} d="M5 19l9-9M11 6c3-2 6-1 8 1-3-1-5 0-6 2" />,
    sunrise: <path {...p} d="M4 17h16M7 17a5 5 0 0 1 10 0M12 7v2M6 10l1.5 1.5M18 10l-1.5 1.5" />,
    container: <path {...p} d="M4 8h16v9H4zM8 8v9M12 8v9M16 8v9" />,
  };
  const bloom = { "years-2": 2, "years-3": 3, "founding-family": 4 }[id as string];
  if (bloom) return <Emblem stage={bloom} head className="size-full" />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-full">
      {shape[id]}
    </svg>
  );
}

type Props = { done: number; earned: string[]; burnOn: boolean; demo?: boolean };

/** Badge row on the very top edge, the campfire every 10 tasks, the badge drop and the 3am line. */
export function FunExtras({ done, earned, burnOn, demo = false }: Props) {
  const on = useFun() && !burnOn;
  const [party, setParty] = useState<number | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [late, setLate] = useState(false);
  const startY = useRef(0);
  useEffect(() => {
    if (!on) return;
    setLate(isSleepHour(new Date().getHours()));
    const plan = funPlan(
      localStorage.getItem(SEEN_KEY),
      done,
      localStorage.getItem(BADGES_KEY) ?? "",
      earned,
    );
    localStorage.setItem(SEEN_KEY, String(done));
    localStorage.setItem(BADGES_KEY, earned.join(","));
    const t = (fn: () => void, ms: number) => window.setTimeout(fn, ms);
    setParty(plan.party);
    const timers = [
      plan.party ? t(() => setParty(null), 3000) : 0,
      plan.drop ? t(() => setDrop(plan.drop), plan.dropAt) : 0,
      plan.drop
        ? t(() => {
            setDrop(null);
            setFresh(plan.drop);
          }, plan.settleAt)
        : 0,
    ];
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [on, done, earned]);
  if (!on) return null;
  return (
    <FunView
      earned={earned}
      demo={demo}
      party={party}
      drop={drop}
      fresh={fresh}
      sheet={sheet}
      late={late}
      onSheet={setSheet}
      startY={startY}
    />
  );
}

type ViewProps = {
  earned: string[];
  demo?: boolean;
  party: number | null;
  drop: string | null;
  fresh: string | null;
  sheet: string | null;
  late: boolean;
  onSheet: (id: string | null) => void;
  startY: { current: number };
};

/** What the fun extras draw for a given moment (no timers, so it renders the same every time). */
export function FunView({
  earned,
  demo = false,
  party,
  drop,
  fresh,
  sheet,
  late,
  onSheet,
  startY,
}: ViewProps) {
  const open = BADGES.find((b) => b.id === sheet);
  const row = badgeRow(earned, drop ?? fresh);
  const shown = BADGES.filter((b) => row.ids.includes(b.id)).sort(
    (a, b) => row.ids.indexOf(a.id) - row.ids.indexOf(b.id),
  );
  return (
    <>
      <nav className="fun-badges" aria-label="My badges" style={{ top: badgeRowTop(demo) }}>
        {shown.map((b) => {
          const got = earned.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-label={badgeLabel(b.name, got)}
              onClick={() => onSheet(b.id)}
              className={badgeClass(got, fresh === b.id, drop === b.id)}
            >
              <BadgeIcon id={b.id} />
            </button>
          );
        })}
        {row.more ? (
          <button
            type="button"
            className="fun-badge fun-badge-more"
            aria-label={`See all badges (${row.more} more)`}
            onClick={() => onSheet("all")}
          >
            +{row.more}
          </button>
        ) : null}
      </nav>
      {late ? <p className="fun-late">go to sleep, legend</p> : null}
      {party !== null ? (
        <div className="fun-fire" aria-live="polite">
          <p className="fun-fire-text">
            {milestoneText(party).title}
            <span>{milestoneText(party).next}</span>
          </p>
          <div className="fun-fire-ring">
            {DOTS.map((d) => (
              <i key={d.id} style={d.style} />
            ))}
            <b />
          </div>
          {party % 100 === 0 ? <div className="fun-sparkle">✦ · ✧ · ✦</div> : null}
        </div>
      ) : null}
      {drop ? (
        <div
          className="fun-drop"
          aria-hidden
          style={{ ...dropTarget(demo), "--fun-x": dropSlotX(drop, row) } as React.CSSProperties}
        >
          <span className="fun-drop-badge">
            <BadgeIcon id={drop} />
          </span>
          <span className="fun-drop-dust" />
        </div>
      ) : null}
      {sheet === "all" ? (
        <div className="fun-sheet" role="dialog" aria-label="All my badges">
          <button
            type="button"
            className="fun-sheet-grip"
            aria-label="Close"
            onClick={() => onSheet(null)}
          />
          <h3 className="heading text-base">All my badges</h3>
          <ul className="mt-2 grid grid-cols-4 gap-3">
            {BADGES.map((b) => {
              const got = earned.includes(b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSheet(b.id)}
                    className="flex w-full flex-col items-center gap-1 text-center text-xs"
                  >
                    <span className={badgeClass(got, false, false)}>
                      <BadgeIcon id={b.id} />
                    </span>
                    {b.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {open ? (
        <div
          className="fun-sheet"
          role="dialog"
          aria-label={open.name}
          onTouchStart={(e) => {
            startY.current = e.touches[0]?.clientY ?? 0;
          }}
          onTouchEnd={(e) => {
            if ((e.changedTouches[0]?.clientY ?? 0) - startY.current > 50) onSheet(null);
          }}
        >
          <button
            type="button"
            className="fun-sheet-grip"
            aria-label="Close"
            onClick={() => onSheet(null)}
          />
          <span className="block size-10 text-ochre">
            <BadgeIcon id={open.id} />
          </span>
          <h3 className="heading mt-1 text-base">{open.name}</h3>
          <p className="text-sm">{open.about}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {earned.includes(open.id) ? "Earned" : "Not earned yet"} · Swipe down to close
          </p>
        </div>
      ) : null}
    </>
  );
}

/** Five quick taps on the logo (or a shake) sends a dust storm across. */
export function LogoTaps({ children }: { children: React.ReactNode }) {
  const counter = useRef(new TapCounter(5, 1500));
  useEffect(() => {
    let last = 0;
    const shake = (e: DeviceMotionEvent) => {
      if (!isShake(e.accelerationIncludingGravity, last, Date.now())) return;
      last = Date.now();
      storm();
    };
    window.addEventListener("devicemotion", shake);
    return () => window.removeEventListener("devicemotion", shake);
  }, []);
  return <span onPointerDown={() => counter.current.tap(Date.now()) && storm()}>{children}</span>;
}

function storm() {
  const burn = Boolean(document.querySelector("[data-burn='on']"));
  if (!stormAllowed(localStorage.getItem(FUN_KEY), burn)) return;
  window.dispatchEvent(new Event(GUST_NOW));
}

/** "Fun extras: on/off" switch, saved on this device. */
export function FunToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(funEnabled(localStorage.getItem(FUN_KEY))), []);
  const flip = () => {
    const { next, store } = flipFun(enabled);
    if (store) localStorage.setItem(FUN_KEY, store);
    else localStorage.removeItem(FUN_KEY);
    setEnabled(next);
    window.dispatchEvent(new Event(FUN_CHANGE));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={flip}
      className={`min-h-8 whitespace-nowrap rounded-full border px-3 text-xs ${enabled ? "bg-primary text-primary-foreground" : "bg-popover text-popover-foreground"}`}
    >
      Fun extras: {enabled ? "on" : "off"}
    </button>
  );
}

/** The playa name rises out of the dust once, the first time it shows here. */
export function PlayaReveal({ name }: { name: string }) {
  const on = useFun();
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!revealPlaya(on, localStorage.getItem("oe-fun-playa"), name)) return;
    localStorage.setItem("oe-fun-playa", name);
    setPlay(true);
  }, [on, name]);
  return (
    <p className={`font-wordmark text-2xl text-ochre ${play ? "fun-reveal" : ""}`}>
      <span className="sr-only">Playa name: </span>
      {name}
    </p>
  );
}
