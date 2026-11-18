import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { formatCampTime } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { myDrafts } from "../../server/draft-queries";
import { DraftActions, DraftForm } from "../components/draft-forms";

/** Drafts: the app writes a vendor email or WhatsApp update; the lead edits, discards or sends. */
export async function DraftsPage({ ctx }: { ctx: ModuleContext }) {
  if (!can(ctx.actor, "procurement.draft"))
    return (
      <div className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-4 text-sm">
        Drafts are for team leads. Ask your team lead to write it for you.
      </div>
    );
  const rows = await myDrafts(ctx);
  const aiReady = !!getEnv().AI_GATEWAY_API_KEY;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <Link href="/procurement" className="text-sm underline">
        ← Kit and stock
      </Link>
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h1 className="heading text-lg">Write a message</h1>
        <p className="text-sm text-muted-foreground">
          {aiReady
            ? "AI writes a draft for you to check (a simple template takes over if the monthly AI limit is used up)."
            : "Demo version: a simple template fills in your words, no AI."}{" "}
          Nothing is sent until you press Send.
        </p>
        <DraftForm />
      </div>
      {rows.map((d) => (
        <div key={d.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {d.kind === "email" ? "Vendor email" : "WhatsApp update"} · written by{" "}
            {d.writer === "ai" ? "AI" : "demo template"} · {formatCampTime(d.createdAt)}
          </p>
          <p className="text-sm">To: {d.toText}</p>
          {d.subject ? <p className="text-sm">Subject: {d.subject}</p> : null}
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-sans text-sm">
            {d.body}
          </pre>
          {d.status === "draft" ? (
            <>
              <DraftActions
                id={d.id}
                kind={d.kind}
                to={d.toText}
                subject={d.subject}
                body={d.body}
              />
              <p className="text-xs text-muted-foreground">
                {d.kind === "email"
                  ? "Nothing is sent until you press Send. The team can see it was sent."
                  : "The app opens WhatsApp with the message ready. You press Send there."}
              </p>
            </>
          ) : (
            <p className="text-sm">{d.status === "sent" ? "Sent." : "Discarded."}</p>
          )}
        </div>
      ))}
    </div>
  );
}
