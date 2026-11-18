import { Check, Circle } from "lucide-react";
import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { CAMP_NAME } from "@/lib/camp";
import { formatCampDay, formatCampTime } from "@/lib/dates";
import { Emblem } from "@/lib/emblem";
import { FAMILY_YEARS_ENABLED } from "@/lib/family-years";
import { formatRand, label, REQUIRED_DOCS, todoList, trackerSteps } from "../../rules/journey";
import { familyByApplication } from "../../server/family-queries";
import { myApplication } from "../../server/queries";
import { ComeHome } from "../components/family-journey";
import { ConfirmDocButton } from "../components/forms";
import { AboutCamp } from "../components/marketing";
import { PlaceholderNote } from "../components/placeholder";
import { Tracker } from "../components/tracker";

/** What to say at the top for each stage. */
function headline(status: string | undefined, interviewAt: Date | null | undefined) {
  if (!status || status === "draft")
    return "Start your application. It takes about 10 minutes and you can save a draft.";
  if (status === "applied")
    return "Thanks for applying! A lead will be in touch to book a short interview.";
  if (status === "interview_scheduled")
    return interviewAt
      ? `Your interview is booked for ${formatCampTime(interviewAt, "EEE d MMM 'at' HH:mm")}.`
      : "Your interview is being booked.";
  if (status === "accepted") return "You're accepted! Finish the list below and you're in.";
  if (status === "declined")
    return "This year it's not a match. Thank you for applying; we hope to see you on the playa.";
  return "You're in.";
}

/** Where an open to-do is done: one tap from the list (spec B3.2). */
function todoHref(key: string): string | null {
  if (key === "form") return "/apply/form";
  if (key.startsWith("doc:")) return `#doc-${key.slice(4)}`;
  return null;
}

/** Applicant home (spec §3): tracker, to-do, required documents, about the camp. */
export async function ApplicantHome({ ctx, sent }: { ctx: ModuleContext; sent: boolean }) {
  const app = await myApplication(ctx.db, ctx.edition.id, ctx.actor.personId ?? "");
  const todo = todoList(app, formatRand);
  const first = ctx.actor.displayName.split(" ")[0] ?? "";
  const status = app?.status;
  const canApply = !status || status === "draft";
  const docsOpen = status !== "declined";
  const fam = app ? await familyByApplication(ctx.db, app.id) : null;
  if (fam && status === "applied") return <ComeHome name={first} years={fam.years} />;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div>
          <p className="heading text-xs">Your application · AfrikaBurn {ctx.edition.year}</p>
          <h1 className="mt-1 text-xl font-semibold">Hi {first}</h1>
          <p className="mt-1 text-sm">{headline(status, app?.interviewAt)}</p>
          {sent ? (
            <p role="status" className="mt-2 text-sm font-semibold">
              Application sent. We'll be in touch.
            </p>
          ) : null}
        </div>
        <Tracker steps={trackerSteps(app)} />
        <p className="text-xs text-muted-foreground">
          Status: <b className="text-foreground">{status ? label(status) : "Not applied"}</b>
        </p>
        {canApply ? (
          <Link
            href="/apply/form"
            className="inline-flex min-h-11 items-center self-start rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {status === "draft" ? "Continue your application" : "Start your application"}
          </Link>
        ) : null}
      </header>
      {canApply && FAMILY_YEARS_ENABLED ? (
        <Link href="/apply/journey" className="journey-card journey-stone no-underline">
          <span aria-hidden className="journey-fire">
            <Emblem stage={2} head />
          </span>
          <span>
            <b>Camped with {CAMP_NAME} before?</b>
            <span className="journey-small block">
              {CAMP_NAME} Family skip the interview. Walk the path home →
            </span>
          </span>
        </Link>
      ) : null}

      <section aria-labelledby="todo-h" className="flex flex-col gap-2">
        <h2 id="todo-h" className="heading text-sm">
          My to-do ({todo.filter((t) => !t.done).length} left)
        </h2>
        <ul className="flex flex-col gap-2">
          {todo.map((t) => (
            <li key={t.key} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
              {t.done ? (
                <Check aria-hidden className="mt-0.5 size-5 shrink-0" />
              ) : (
                <Circle aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm">
                {!t.done && todoHref(t.key) ? (
                  <a href={todoHref(t.key) ?? ""} className="font-semibold underline">
                    {t.label}
                  </a>
                ) : (
                  <span className={t.done ? "line-through decoration-1" : "font-semibold"}>
                    {t.label}
                  </span>
                )}
                <span className="sr-only">{t.done ? " (done)" : " (to do)"}</span>
                {t.hint ? (
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="docs-h" className="flex flex-col gap-2">
        <h2 id="docs-h" className="heading text-sm">
          Required documents and forms
        </h2>
        <PlaceholderNote what="these documents stand in for the real ones." />
        <article className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h3 className="font-semibold">Application form</h3>
          <p className="text-sm text-muted-foreground">
            {app?.submittedAt
              ? `Sent ${formatCampDay(app.submittedAt, "d MMM yyyy")}.`
              : "Not sent yet."}
          </p>
          <Link href="/apply/form" className="text-sm font-semibold underline">
            {app?.submittedAt ? "See your answers" : "Open the form"}
          </Link>
        </article>
        {REQUIRED_DOCS.map((d) => {
          const done = app?.docsDone.includes(d.key) ?? false;
          return (
            <article
              key={d.key}
              id={`doc-${d.key}`}
              className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border bg-card p-4"
            >
              <h3 className="font-semibold">{d.title}</h3>
              <p className="text-sm text-muted-foreground">{d.body}</p>
              {done ? (
                <p className="flex items-center gap-1 text-sm font-semibold">
                  <Check aria-hidden className="size-4" /> Confirmed
                </p>
              ) : docsOpen ? (
                <ConfirmDocButton docKey={d.key} title={d.title} />
              ) : null}
            </article>
          );
        })}
      </section>

      <AboutCamp />
    </div>
  );
}
