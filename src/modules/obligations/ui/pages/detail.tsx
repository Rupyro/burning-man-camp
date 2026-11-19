import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { DetailLayout, DetailSection } from "@/components/ui/detail-layout";
import { instantToCampInput } from "@/lib/dates";
import { EVENT_NAME } from "@/lib/event";
import { AUTHORITY_LABEL, dueLabel, obligationState } from "../../rules/status";
import { getObligation, listAssignable, listDocuments } from "../../server/queries";
import { DueText, StateChip } from "../components/chip";
import { EditForm, ReopenButton, SubmitForm } from "../components/forms";

export async function DetailPage({ ctx, taskId }: { ctx: ModuleContext; taskId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) notFound();
  const o = await getObligation(ctx.db, ctx.edition.id, taskId);
  if (!o) notFound();
  const documents = await listDocuments(ctx.db, o.taskId);
  const manager = can(ctx.actor, "obligations.manage");
  const maySubmit = can(ctx.actor, "obligations.submit", { ownerPersonId: o.ownerPersonId });
  const state = obligationState(o, ctx.now);
  const label = dueLabel(o.dueAt, o.dateConfirmed, o.previousYearDate);
  return (
    <DetailLayout
      back={
        <Link href="/obligations" className="underline">
          ← All deadlines
        </Link>
      }
      title={o.title}
      badges={<StateChip state={state} />}
      description={o.notes ?? undefined}
      facts={[
        ["Due", <DueText key="due" {...label} />],
        ["Owner", o.ownerName ?? "No owner yet"],
        ["Authority", AUTHORITY_LABEL[o.authority]],
        ...(o.submittedAt
          ? [
              [
                "Submitted",
                `${o.submittedAt.toISOString().slice(0, 10)}${o.confirmationRef ? ` · ref ${o.confirmationRef}` : ""}`,
              ] as [string, string],
            ]
          : []),
      ]}
      aside={
        <>
          {maySubmit && o.status !== "done" && o.status !== "cancelled" ? (
            <DetailSection title="Done it?" boxed>
              <SubmitForm taskId={o.taskId} />
            </DetailSection>
          ) : null}
          {manager && o.status === "done" ? <ReopenButton taskId={o.taskId} /> : null}
          {manager ? (
            <DetailSection title="Edit" boxed>
              <EditForm
                taskId={o.taskId}
                dueDate={o.dueAt ? instantToCampInput(o.dueAt).date : ""}
                dateConfirmed={o.dateConfirmed}
                ownerPersonId={o.ownerPersonId}
                sourceUrl={o.sourceUrl ?? ""}
                notes={o.notes ?? ""}
                documents={documents.map((d) => d.name).join("\n")}
                people={await listAssignable(ctx.db, ctx.edition.id)}
              />
            </DetailSection>
          ) : null}
        </>
      }
    >
      {documents.length ? (
        <DetailSection title="You'll need">
          <ul className="flex flex-col gap-1">
            {documents.map((d) => (
              <li key={d.id} className="flex gap-2">
                <span aria-hidden>{d.status === "done" ? "✓" : "·"}</span>
                <span>{d.name}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
      <DetailSection title="More">
        {o.sourceUrl ? (
          <a href={o.sourceUrl} className="underline" rel="noreferrer" target="_blank">
            {EVENT_NAME} rules for this
          </a>
        ) : null}
        <Link href={`/tasks/${o.taskId}`} className="underline">
          Open as a task (checklist, comments, helpers)
        </Link>
      </DetailSection>
    </DetailLayout>
  );
}
