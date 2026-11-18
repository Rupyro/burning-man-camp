import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { FORM_FIELDS } from "../../rules/form";
import { myApplication } from "../../server/queries";
import { ApplicationForm } from "../components/forms";
import { PlaceholderNote } from "../components/placeholder";

/** The PLACEHOLDER application form (spec §3): editable until a lead decides. */
export async function FormPage({ ctx }: { ctx: ModuleContext }) {
  const app = await myApplication(ctx.db, ctx.edition.id, ctx.actor.personId ?? "");
  const status = app?.status ?? "draft";
  const locked = !["draft", "applied", "interview_scheduled"].includes(status);
  const sent = Boolean(app?.submittedAt);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/apply" className="text-sm underline">
        ← Back to your application
      </Link>
      <header>
        <p className="heading text-xs">Apply to join</p>
        <h1 className="text-xl font-semibold">Application form</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locked
            ? "A lead has decided on your application, so the answers are final."
            : sent
              ? "Sent. You can still change your answers until a lead decides."
              : "Questions marked * are needed to send. Save a draft any time."}
        </p>
      </header>
      <PlaceholderNote what="these questions are examples." />
      <div className="rounded-2xl border bg-card p-4">
        <ApplicationForm
          fields={FORM_FIELDS}
          answers={app?.answers ?? {}}
          sent={sent}
          locked={locked}
        />
      </div>
    </div>
  );
}
