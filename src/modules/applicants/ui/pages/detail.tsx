import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { formatCampTime, instantToCampInput } from "@/lib/dates";
import { FORM_FIELDS } from "../../rules/form";
import { formatRand, label, leadMoves, todoList, trackerSteps } from "../../rules/journey";
import { applicationById } from "../../server/queries";
import { ReviewForm } from "../components/forms";
import { Tracker } from "../components/tracker";

const MOVE_LABEL: Record<string, string> = {
  applied: "Re-open (back to Applied)",
  interview_scheduled: "Interview scheduled (set the date below)",
  accepted: "Interview done: accept",
  declined: "Decline",
};

/** One application for reviewers (spec §4): answers, checklist, fee, and the update form. */
export async function DetailPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  const app = await applicationById(ctx.db, ctx.edition.id, id);
  if (!app) notFound();
  const decide = can(ctx.actor, "applicants.decide", { personId: app.personId });
  const moves = leadMoves(app.status).map((m) => ({ value: m, label: MOVE_LABEL[m] ?? m }));
  const interview = app.interviewAt ? instantToCampInput(app.interviewAt) : { date: "", time: "" };
  const todo = todoList(app, formatRand);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/apply/review" className="text-sm underline">
        ← Open applications
      </Link>
      <header className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold">{app.name}</h1>
          <p className="text-sm">
            Status: <b>{label(app.status)}</b>
            {app.interviewAt
              ? ` · Interview ${formatCampTime(app.interviewAt, "EEE d MMM, HH:mm")}`
              : ""}
          </p>
        </div>
        <Tracker steps={trackerSteps(app)} />
      </header>
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="answers-h" className="flex flex-col gap-2">
          <h2 id="answers-h" className="heading text-sm">
            Answers (placeholder form)
          </h2>
          <dl className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm">
            {FORM_FIELDS.map((f) => (
              <div key={f.key}>
                <dt className="font-semibold">{f.label}</dt>
                <dd className="whitespace-pre-line text-muted-foreground">
                  {app.answers[f.key] || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="flex flex-col gap-5">
          <section aria-labelledby="checklist-h" className="flex flex-col gap-2">
            <h2 id="checklist-h" className="heading text-sm">
              Requirements
            </h2>
            <ul className="flex flex-col gap-1 rounded-2xl border bg-card p-4 text-sm">
              {todo.map((t) => (
                <li key={t.key} className="flex items-center gap-2">
                  {t.done ? (
                    <Check aria-hidden className="size-4" />
                  ) : (
                    <Circle aria-hidden className="size-4 text-muted-foreground" />
                  )}
                  {t.label}
                  <span className="sr-only">{t.done ? "(done)" : "(not yet)"}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              The camp fee is recorded in Money → Camp fees (demo: no real money moves).
            </p>
          </section>
          {decide ? (
            <section aria-labelledby="update-h" className="flex flex-col gap-2">
              <h2 id="update-h" className="heading text-sm">
                Update
              </h2>
              <div className="rounded-2xl border bg-card p-4">
                {app.status === "joined" ? (
                  <p className="text-sm">They've joined. Changes now happen in People.</p>
                ) : (
                  <ReviewForm
                    id={app.id}
                    moves={moves}
                    interview={interview}
                    note={app.leadNote ?? ""}
                  />
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
