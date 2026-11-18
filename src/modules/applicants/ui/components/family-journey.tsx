"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { CAMP_NAME } from "@/lib/camp";
import { Emblem, EmblemBud } from "@/lib/emblem";
import { proteaStage } from "@/lib/family-years";
import {
  FAMILY_BUILD_PIECES,
  FAMILY_GOOD_AT,
  FAMILY_LOVE_TO,
  FAMILY_TEAMS,
  litMessage,
} from "../../rules/family";
import { sendFamilyJourney } from "../../server/family-actions";

const BEATS = ["Arrive", "Remember", "Dream", "Come home"];
const PTS: [number, number][] = [
  [40, 46],
  [140, 22],
  [250, 48],
  [350, 24],
];
const D = "M10 40 C 60 70, 100 0, 140 22 S 220 75, 250 48 S 320 0, 380 30";

/** The sandy path with four campfires that light up as you walk it. */
export function JourneyPath({ step }: { step: number }) {
  const clip = [0, 150, 265, 360, 390][step] ?? 390;
  return (
    <svg
      viewBox="0 0 390 78"
      className="journey-path"
      role="img"
      aria-label={`Step ${step} of 4: ${BEATS[step - 1]}`}
    >
      <defs>
        <clipPath id="jp-clip">
          <rect width={clip} height="78" />
        </clipPath>
        <radialGradient id="jp-fire">
          <stop offset="0" stopColor="var(--fire-hot)" />
          <stop offset=".5" stopColor="var(--fire-mid)" />
          <stop offset="1" stopColor="var(--fire-ember)" />
        </radialGradient>
      </defs>
      <path d={D} className="jp-sand" />
      <path d={D} className="jp-steps" clipPath="url(#jp-clip)" />
      {PTS.map(([x, y], i) => {
        const lit = i < step;
        return (
          <g key={BEATS[i]}>
            {lit ? <circle cx={x} cy={y} r={15} className="jp-halo" /> : null}
            <circle cx={x} cy={y} r={lit ? 9 : 8} className={lit ? "jp-lit" : "jp-cold"} />
            <text
              x={x}
              y={y + (y < 35 ? 24 : -14)}
              textAnchor="middle"
              className={lit ? "jp-label is-lit" : "jp-label"}
            >
              {BEATS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Chips(p: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <fieldset className="journey-chips" aria-label={p.label}>
      {p.options.map((o) => {
        const on = p.value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            className={on ? "journey-chip is-on" : "journey-chip"}
            onClick={() => p.onChange(on ? p.value.filter((x) => x !== o) : [...p.value, o])}
          >
            {o}
          </button>
        );
      })}
    </fieldset>
  );
}

function Stone(p: { icon: string; title: string; children: React.ReactNode; cold?: boolean }) {
  return (
    <div className="journey-card journey-stone">
      <span aria-hidden className={p.cold ? "journey-fire is-cold" : "journey-fire"}>
        {p.icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="journey-h3">{p.title}</h3>
        {p.children}
      </div>
    </div>
  );
}

/** Oe-aa-sies Family: Arrive → Remember → Dream, then send and come home. */
export function FamilyJourney({
  years: offered,
  nowIso,
  editionYear,
}: {
  years: number[];
  nowIso: string;
  editionYear: number;
}) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(1);
  const [family, setFamily] = useState<boolean | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [led, setLed] = useState<boolean | null>(null);
  const [ledWhat, setLedWhat] = useState("");
  const [pieces, setPieces] = useState<string[]>([]);
  const [goodAt, setGoodAt] = useState<string[]>([]);
  const [loveTo, setLoveTo] = useState<string[]>([]);
  const [anything, setAnything] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (s: number, p = 1) => {
    setStep(s);
    setPage(p);
    window.scrollTo?.(0, 0);
  };
  const send = () =>
    start(async () => {
      setMsg(null);
      try {
        const r = await sendFamilyJourney({
          years,
          teams,
          led: led === true,
          ledWhat,
          buildPieces: pieces,
          goodAt,
          loveTo,
          anythingElse: anything,
        });
        if (isActionFailure(r)) return setMsg(r.error);
        if (!r.ok) return setMsg(r.error);
        router.refresh();
      } catch {
        setMsg("No signal? Please try again.");
      }
    });
  const kick = [
    "Step 1 of 4 · Arrive",
    "Step 2 of 4 · Walking back through your years",
    "Step 3 of 4 · Dream of this year",
  ][step - 1];
  const title =
    step === 1
      ? "Welcome home."
      : step === 2
        ? page === 1
          ? "Remember the dust."
          : "What you made out there."
        : `Look toward ${editionYear}.`;
  return (
    <div className="journey">
      <JourneyPath step={step} />
      <div className="journey-hero">
        <p className="journey-kick">{kick}</p>
        <h1 className="journey-h1">{title}</h1>
        {step === 1 ? (
          <p className="journey-sub">Let's walk the path back to camp together.</p>
        ) : null}
      </div>
      {step === 1 ? (
        <>
          <div className="journey-card">
            <h3 className="journey-h3">Have you camped with {CAMP_NAME} before?</h3>
            <p className="journey-small">
              {CAMP_NAME} Family skip the interview. A camp admin just checks and welcomes you in.
            </p>
            <div className="journey-big">
              <button
                type="button"
                aria-pressed={family === true}
                className={family === true ? "journey-chip is-on" : "journey-chip"}
                onClick={() => setFamily(true)}
              >
                Yes, I'm family
              </button>
              <button
                type="button"
                aria-pressed={family === false}
                className={family === false ? "journey-chip is-on" : "journey-chip"}
                onClick={() => setFamily(false)}
              >
                No, I'm new
              </button>
            </div>
          </div>
          {family === true ? (
            <>
              <div className="journey-card">
                <h3 className="journey-h3">Which years did you walk this path with us?</h3>
                <p className="journey-small">{litMessage([], now)}</p>
                <div className="journey-protea">
                  <Emblem
                    stage={proteaStage(years.length)}
                    className={years.length ? "" : "is-waiting"}
                  />
                </div>
                <div className="journey-lanterns">
                  {offered.map((y) => {
                    const on = years.includes(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={on}
                        className={on ? "journey-lantern is-on" : "journey-lantern"}
                        onClick={() => setYears(on ? years.filter((x) => x !== y) : [...years, y])}
                      >
                        <i aria-hidden>{on ? <EmblemBud /> : null}</i>
                        {y}
                      </button>
                    );
                  })}
                </div>
                <p className="journey-small mt-2 text-center font-bold" aria-live="polite">
                  {litMessage(years, now)}
                </p>
              </div>
              <button
                type="button"
                className="journey-btn"
                disabled={!years.length}
                onClick={() => go(2)}
              >
                Walk back through your years →
              </button>
            </>
          ) : family === false ? (
            <>
              <div className="journey-card journey-stone">
                <span aria-hidden className="journey-fire">
                  👋
                </span>
                <p className="text-sm">
                  We'd love to meet you. Next we'll ask a little about you, then you'll have a short
                  chat with one of the leads.
                </p>
              </div>
              <Link href="/apply/form" className="journey-btn">
                Keep walking →
              </Link>
            </>
          ) : null}
        </>
      ) : null}
      {step === 2 && page === 1 ? (
        <>
          <Stone icon="🍲" title="Who did you stand beside?">
            <p className="journey-small">The teams you helped</p>
            <Chips label="Teams" options={FAMILY_TEAMS} value={teams} onChange={setTeams} />
          </Stone>
          <Stone icon="🔥" title="Did you lead the way on anything?">
            <div className="journey-big">
              <button
                type="button"
                aria-pressed={led === true}
                className={led === true ? "journey-chip is-on" : "journey-chip"}
                onClick={() => setLed(true)}
              >
                Yes
              </button>
              <button
                type="button"
                aria-pressed={led === false}
                className={led === false ? "journey-chip is-on" : "journey-chip"}
                onClick={() => setLed(false)}
              >
                Not yet
              </button>
            </div>
            {led ? (
              <input
                aria-label="What did you lead?"
                className="journey-input"
                value={ledWhat}
                maxLength={300}
                placeholder="For example: co-led the Cloud build"
                onChange={(e) => setLedWhat(e.target.value)}
              />
            ) : null}
          </Stone>
          <button type="button" className="journey-btn" onClick={() => go(2, 2)}>
            Keep remembering →
          </button>
        </>
      ) : null}
      {step === 2 && page === 2 ? (
        <>
          <Stone icon="🪵" title="What did your hands build?">
            <Chips
              label="Build pieces"
              options={FAMILY_BUILD_PIECES}
              value={pieces}
              onChange={setPieces}
            />
          </Stone>
          <Stone icon="✨" title="What are you good at, or love doing?">
            <Chips label="Good at" options={FAMILY_GOOD_AT} value={goodAt} onChange={setGoodAt} />
          </Stone>
          <button type="button" className="journey-btn" onClick={() => go(3)}>
            Look ahead →
          </button>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Stone icon="🌅" title="What would you love to help with?">
            <Chips label="This year" options={FAMILY_LOVE_TO} value={loveTo} onChange={setLoveTo} />
          </Stone>
          <Stone icon="🪶" title="Anything we should know?" cold>
            <textarea
              aria-label="Anything we should know?"
              className="journey-input"
              rows={2}
              maxLength={1000}
              value={anything}
              placeholder="Optional. Arriving late, a sore back, a great idea…"
              onChange={(e) => setAnything(e.target.value)}
            />
          </Stone>
          <button type="button" className="journey-btn" disabled={pending} onClick={send}>
            {pending ? "Sending…" : "Send, and come home →"}
          </button>
        </>
      ) : null}
      {step > 1 ? (
        <button
          type="button"
          className="journey-back"
          onClick={() =>
            step === 2 && page === 2 ? go(2, 1) : go(step - 1, step - 1 === 2 ? 2 : 1)
          }
        >
          ← Back
        </button>
      ) : null}
      {msg ? (
        <p role="alert" className="text-sm">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

/** Come home: path complete, the fire's lit, waiting for an admin to welcome you in. */
export function ComeHome({ name, years }: { name: string; years: number[] }) {
  return (
    <div className="journey">
      <JourneyPath step={4} />
      <div className="journey-hero">
        <p className="journey-kick">Step 4 of 4 · Come home</p>
        <h1 className="journey-h1">The fire's lit.</h1>
      </div>
      <div className="journey-card text-center">
        <div className="journey-home-scene">
          <div aria-hidden className="journey-campfire" />
          <Emblem stage={proteaStage(years.length)} className="journey-home-protea" />
        </div>
        <h3 className="journey-h3 text-2xl">Welcome back, {name}!</h3>
        <p>
          {years.map((y) => (
            <span key={y} className="journey-pill">
              <EmblemBud /> {y}
            </span>
          ))}
        </p>
        <p className="journey-small mt-2">
          Returning family · your interview is skipped
          <br />
          <b>Waiting for a lead to welcome you in</b>
        </p>
      </div>
      <div className="journey-card journey-stone">
        <span aria-hidden className="journey-fire">
          💬
        </span>
        <p className="text-sm">
          A camp admin will look over your years and memories, and say yes. We'll send you a message
          the moment the gate opens. Usually within a few days.
        </p>
      </div>
    </div>
  );
}
