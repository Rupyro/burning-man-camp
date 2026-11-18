import { ForbiddenError } from "@/base/errors";
import { getBatch } from "@/base/ingest/batches";
import { basePage } from "../../../_components/base-page";
import { ApproveButton, RowDecision, UndoButton } from "./row-decision";

const LABEL: Record<string, string> = {
  ok: "Fine as it is",
  cleaned: "Tidied",
  needs_review: "Needs a look",
  duplicate: "Possible duplicate",
};

/** One upload: every row with its label, the sheet's values and the cleaned values. Admins only. */
export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { batch, rows } = await basePage(async (ctx) => {
    if (!ctx.actor.isAdmin) throw new ForbiddenError();
    return getBatch(ctx, id);
  });
  const pending = rows.filter((r) => r.decision === "pending").length;
  const order = ["needs_review", "duplicate", "cleaned", "ok"];
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label) || a.line - b.line,
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">{batch.fileName}</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} rows · {pending} waiting for you · status: {batch.status}
      </p>
      {batch.status === "review" ? <ApproveButton id={batch.id} disabled={pending > 0} /> : null}
      {batch.status === "imported" ? <UndoButton id={batch.id} /> : null}
      <ul className="flex flex-col gap-3">
        {sorted.map((r) => {
          const cleaned = r.cleaned as Record<string, unknown>;
          return (
            <li key={r.id} className="rounded-2xl border bg-card p-4" data-label={r.label}>
              <p className="text-sm font-medium">
                Line {r.line} · {LABEL[r.label] ?? r.label}
                {r.duplicateOfLine ? ` (same as line ${r.duplicateOfLine})` : ""}
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                {Object.entries(r.raw as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              {(r.issues as string[]).length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes: {(r.issues as string[]).join(", ").replaceAll("_", " ")}
                </p>
              ) : null}
              <RowDecision
                rowId={r.id}
                decision={r.decision}
                responsible={typeof cleaned.responsible === "string" ? cleaned.responsible : null}
                setResponsible={r.setResponsible}
                editable={batch.status === "review"}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
