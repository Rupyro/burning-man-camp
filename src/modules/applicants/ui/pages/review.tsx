import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { formatCampDay } from "@/lib/dates";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  label,
  missingForJoin,
} from "../../rules/journey";
import { listApplications, stageCounts } from "../../server/queries";

const FILTERS: ApplicationStatus[] = [
  "applied",
  "interview_scheduled",
  "accepted",
  "draft",
  "declined",
  "joined",
];

const when = (d: Date | null) => (d ? formatCampDay(d, "EEE d MMM, HH:mm") : "—");

/** Open applications (spec §4): counts per stage, a stage filter, and each applicant's next step. */
export async function ReviewPage({
  ctx,
  stage,
}: {
  ctx: ModuleContext;
  stage: string | undefined;
}) {
  const chosen = APPLICATION_STATUSES.find((s) => s === stage);
  const [rows, counts] = await Promise.all([
    listApplications(ctx.db, ctx.edition.id, chosen),
    stageCounts(ctx.db, ctx.edition.id),
  ]);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const chip = (href: string, text: string, on: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={on ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
        on ? "border-earth bg-earth font-semibold text-ochre" : "bg-card"
      }`}
    >
      {text}
    </Link>
  );
  const missing = (r: (typeof rows)[number]) =>
    r.status === "joined" || r.status === "declined"
      ? "—"
      : missingForJoin(r).join(", ") || "Nothing";
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="heading text-lg">Open applications</h1>
        <p className="text-sm text-muted-foreground">
          {total} for AfrikaBurn {ctx.edition.year}. Open one to book an interview or change its
          status. Joining happens by itself once they've paid and done everything.
        </p>
      </header>
      <nav aria-label="Filter by stage" className="flex flex-wrap gap-2">
        {chip("/apply/review", `All (${total})`, !chosen)}
        {FILTERS.map((s) =>
          chip(`/apply/review?stage=${s}`, `${label(s)} (${counts.get(s) ?? 0})`, chosen === s),
        )}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">Nobody at this stage right now.</p>
      ) : null}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/apply/review/${r.id}`} className="block rounded-2xl border bg-card p-3">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="heading shrink-0 text-[11px]">{label(r.status)}</span>
              </span>
              {r.status === "interview_scheduled" ? (
                <span className="block text-sm">Interview {when(r.interviewAt)} (camp time)</span>
              ) : null}
              <span className="block text-xs text-muted-foreground">
                Still missing: {missing(r)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length ? (
        <table className="hidden w-full border-collapse overflow-hidden rounded-2xl bg-card text-sm md:table">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-3">
                Applicant
              </th>
              <th scope="col" className="p-3">
                Stage
              </th>
              <th scope="col" className="p-3">
                Interview (camp time)
              </th>
              <th scope="col" className="p-3">
                Applied
              </th>
              <th scope="col" className="p-3">
                Still missing
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/apply/review/${r.id}`} className="font-semibold underline">
                    {r.name}
                  </Link>
                </td>
                <td className="p-3">{label(r.status)}</td>
                <td className="p-3">
                  {r.status === "interview_scheduled" ? when(r.interviewAt) : "—"}
                </td>
                <td className="p-3">
                  {r.submittedAt ? formatCampDay(r.submittedAt, "d MMM") : "—"}
                </td>
                <td className="p-3 text-muted-foreground">{missing(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
