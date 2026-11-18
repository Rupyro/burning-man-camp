"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { endTeamNotice, gotItTeamNotice, postTeamNotice } from "@/base/teams/server/notice-actions";
import { campInputToInstant } from "@/lib/dates";

export interface BannerNotice {
  id: string;
  body: string;
  teamName: string;
  authorName: string;
  until: string;
}

/** Option C: a strip across the top of every page until the end time or "Got it". */
export function NoticeBanner({ notices }: { notices: BannerNotice[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const shown = notices.filter((n) => !hidden.includes(n.id));
  if (!shown.length) return null;
  const gotIt = (id: string) =>
    start(async () => {
      setError(null);
      const r = await gotItTeamNotice({ noticeId: id }).catch(() => ({
        ok: false as const,
        error: "No signal? Try again.",
      }));
      if (!r.ok) return setError(r.error ?? "Couldn't save that. Try again.");
      setHidden((h) => [...h, id]);
      router.refresh();
    });
  return (
    <section aria-label="Team notices" className="team-notice flex flex-col">
      {shown.map((n) => (
        <div key={n.id} className="flex items-center gap-3 px-4 py-2">
          <span aria-hidden className="text-lg">
            📣
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <b>{n.body}</b>
            <span className="block text-xs opacity-85">
              {n.authorName}, {n.teamName} · showing until {n.until}
            </span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => gotIt(n.id)}
            className="team-notice-btn min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold"
          >
            Got it
          </button>
        </div>
      ))}
      {error ? (
        <p role="alert" className="px-4 pb-2 text-xs">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** For the lead: take the banner down now. Asks once before ending. */
export function EndNoticeButton({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = () =>
    start(async () => {
      setError(null);
      const r = await endTeamNotice({ noticeId }).catch(() => ({
        ok: false as const,
        error: "No signal? Try again.",
      }));
      if (!r.ok) return setError(r.error ?? "Couldn't end it. Try again.");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sure ? (
        <>
          <span className="text-sm">Take it down for everyone now?</span>
          <button
            type="button"
            disabled={pending}
            onClick={end}
            className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Yes, end it
          </button>
          <button
            type="button"
            onClick={() => setSure(false)}
            className="min-h-11 rounded-full border px-4 text-sm"
          >
            Keep it
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setSure(true)}
          className="min-h-11 rounded-full border px-4 text-sm font-semibold"
        >
          End now
        </button>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface EndChoice {
  label: string;
  at: string;
}

const chip = "min-h-11 rounded-full border-2 px-4 text-sm font-semibold";

/** Lead's form: pick the team (if more than one), write the notice, tap when it should end. */
export function NoticeComposer({
  teams,
  choices,
}: {
  teams: { id: string; name: string }[];
  choices: EndChoice[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("18:00");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pickedEnd = () => {
    if (!custom) return endsAt;
    if (!day) return null;
    return campInputToInstant(day, time).toISOString();
  };
  const submit = () =>
    start(async () => {
      setMsg(null);
      const at = pickedEnd();
      if (!body.trim()) return setMsg({ ok: false, text: "Write what the notice says." });
      if (!at) return setMsg({ ok: false, text: "Pick when the notice should end." });
      const r = await postTeamNotice({ teamId, body, endsAt: at }).catch(() => ({
        ok: false as const,
        error: "No signal? Try again.",
      }));
      if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Couldn't post it. Try again." });
      setBody("");
      setEndsAt(null);
      setCustom(false);
      setMsg({ ok: true, text: "Posted. Your team will see it at the top of every page." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {teams.length > 1 ? (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm font-semibold">Which team?</legend>
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={teamId === t.id}
              onClick={() => setTeamId(t.id)}
              className={`${chip} ${teamId === t.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {t.name}
            </button>
          ))}
        </fieldset>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        What should your team know?
        <textarea
          value={body}
          maxLength={280}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Container loading Saturday 8am. Bring gloves."
          className="rounded-xl border bg-card p-3 text-base font-normal"
        />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold">Show it until</legend>
        {choices.map((c) => (
          <button
            key={c.at}
            type="button"
            aria-pressed={!custom && endsAt === c.at}
            onClick={() => {
              setCustom(false);
              setEndsAt(c.at);
            }}
            className={`${chip} ${!custom && endsAt === c.at ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={`${chip} ${custom ? "bg-primary text-primary-foreground" : "bg-card"}`}
        >
          Pick a day and time
        </button>
      </fieldset>
      {custom ? (
        <span className="flex flex-wrap gap-2">
          <input
            type="date"
            aria-label="End day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="min-h-11 rounded-xl border bg-card px-3"
          />
          <input
            type="time"
            aria-label="End time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-11 rounded-xl border bg-card px-3"
          />
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          {pending ? "Posting…" : "Post notice"}
        </button>
        {msg ? (
          <span
            role={msg.ok ? "status" : "alert"}
            className={`text-sm ${msg.ok ? "" : "text-destructive"}`}
          >
            {msg.text}
          </span>
        ) : null}
      </span>
    </div>
  );
}
