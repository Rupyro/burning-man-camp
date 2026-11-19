import { getEditionSettings } from "@/base/editions/settings";
import { CAMP_TZ_LABEL, formatCampTime } from "@/lib/dates";
import { basePage } from "../_components/base-page";
import { anchorFormInitial, capacityLine } from "./anchor-input";
import { AnchorForm, EditionForm } from "./edition-forms";

/** Edition settings (spec b1-12): capacity, title and key dates. Plain markup until the design is agreed. */
export default async function EditionPage() {
  const s = await basePage((ctx) => getEditionSettings(ctx));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading text-lg">Edition settings · {s.year}</h1>

      <section aria-labelledby="basics" className="flex flex-col gap-2">
        <h2 id="basics" className="heading text-sm">
          Title and capacity
        </h2>
        <p className="text-sm text-muted-foreground">
          {capacityLine(s.confirmed, s.capacity)} Confirming a member stops at the capacity; the CSV
          import only warns.
        </p>
        <EditionForm title={s.title} capacity={s.capacity} />
      </section>

      <section aria-labelledby="dates" className="flex flex-col gap-3">
        <h2 id="dates" className="heading text-sm">
          Key dates
        </h2>
        <p className="text-sm text-muted-foreground">
          Times are camp time ({CAMP_TZ_LABEL}). Task templates will schedule against these keys, so
          keep a key once it's in use. Leave "Confirmed" unticked while a date is still a draft
          (shows TBC).
        </p>
        {s.anchors.length === 0 ? (
          <p className="text-sm">No key dates yet. Add the first one below.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {s.anchors.map((a) => (
              <li key={a.key} className="rounded-2xl border bg-card p-3">
                <p className="font-medium">
                  {a.label} <span className="text-sm text-muted-foreground">({a.key})</span>{" "}
                  <span className="text-sm">{a.isConfirmed ? "Confirmed" : "TBC"}</span>
                </p>
                <p className="text-sm">
                  {formatCampTime(a.startsAt)}
                  {a.endsAt ? ` to ${formatCampTime(a.endsAt)}` : ""}
                </p>
                {a.sourceNote ? (
                  <p className="text-sm text-muted-foreground">Source: {a.sourceNote}</p>
                ) : null}
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm">Edit</summary>
                  <AnchorForm initial={anchorFormInitial(a)} />
                </details>
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-medium">Add a key date</h3>
        <AnchorForm initial={null} />
      </section>
    </div>
  );
}
