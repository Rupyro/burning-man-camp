import Link from "next/link";
import { ForbiddenError } from "@/base/errors";
import { listBatches } from "@/base/ingest/batches";
import { basePage } from "../../_components/base-page";
import { UploadForm } from "./upload-form";

/** Import review: upload a sheet, the cleaner checks it, an admin decides each row. Admins only. */
export default async function ImportsPage() {
  const batches = await basePage(async (ctx) => {
    if (!ctx.actor.isAdmin) throw new ForbiddenError();
    return listBatches(ctx);
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Imports to review</h1>
      <p className="text-sm text-muted-foreground">
        Upload a sheet saved as CSV. The cleaner tidies it and labels every row. Nothing goes into
        the camp records until you approve it, and even then it waits for the import step.
      </p>
      <section className="rounded-2xl border bg-card p-4">
        <UploadForm />
      </section>
      <ul className="flex flex-col gap-2">
        {batches.map((b) => {
          const s = b.summary as { counts?: Record<string, number> };
          return (
            <li key={b.id} className="rounded-2xl border bg-card p-4">
              <Link href={`/settings/imports/${b.id}`} className="font-medium underline">
                {b.fileName}
              </Link>
              <p className="text-sm text-muted-foreground">
                {b.kind} · {b.status} · {s.counts?.rows ?? 0} rows · {s.counts?.needs_review ?? 0}{" "}
                need review · {s.counts?.duplicate ?? 0} possible duplicates
              </p>
            </li>
          );
        })}
        {batches.length === 0 ? <li className="text-sm">No uploads yet.</li> : null}
      </ul>
    </div>
  );
}
