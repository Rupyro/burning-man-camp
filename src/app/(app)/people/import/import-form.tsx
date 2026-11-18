"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ImportReport, Resolution } from "@/base/people/import/import";
import { importApply, importDryRun } from "@/base/people/server/actions";
import { Button } from "@/components/ui/button";
import {
  choices,
  countsLine,
  needsChoice,
  readChoice,
  resultMessage,
  rowSummary,
  rowsToShow,
} from "./report-text";

type Field = { key: string; label: string };
type Mapping = NonNullable<Parameters<typeof importDryRun>[0]["mapping"]>;

export function ImportForm({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const call = (apply: boolean, map: Mapping | null) =>
    start(async () => {
      if (!file) return;
      const args = { csv: file.csv, fileName: file.name, mapping: map ?? undefined, resolutions };
      const r = await (apply ? importApply(args) : importDryRun(args));
      if (!r.ok) return setMessage(r.error);
      setReport(r.data);
      setMapping(r.data.mapping);
      setMessage(resultMessage(r.data));
      if (apply) router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        className="min-h-11"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFile({ name: f.name, csv: await f.text() });
          setReport(null);
          setMapping(null);
          setResolutions({});
        }}
      />
      <Button
        disabled={!file || pending}
        onClick={() => call(false, mapping)}
        className="min-h-11 self-start"
      >
        {pending ? "Working…" : "Dry run"}
      </Button>
      {message ? <p role="status">{message}</p> : null}
      {report && mapping ? (
        <>
          <section className="flex flex-col gap-1 text-sm">
            <h2 className="font-semibold">Columns</h2>
            {report.headers
              .map((h, i) => ({ h, i, id: `col${i}:${h}` }))
              .map(({ h, i, id }) => (
                <label key={id} className="flex items-center gap-2">
                  <span className="w-48 truncate">{h || `(column ${i + 1})`}</span>
                  <select
                    className="min-h-11 rounded-md border px-2"
                    value={mapping[i] ?? ""}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[i] = (e.target.value || null) as Mapping[number];
                      setMapping(next);
                    }}
                  >
                    <option value="">(ignore)</option>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </section>
          <p className="text-sm">{countsLine(report.counts)}</p>
          {report.warnings.map((w) => (
            <p key={w} className="text-sm text-destructive">
              {w}
            </p>
          ))}
          <ul className="flex flex-col gap-1 text-sm">
            {rowsToShow(report).map((r) => (
              <li key={r.line} className="rounded-md border p-2">
                {rowSummary(r)}
                {needsChoice(r, resolutions) ? (
                  <select
                    aria-label={`Line ${r.line}: what to do`}
                    className="ml-2 min-h-11 rounded-md border px-2"
                    value={JSON.stringify(resolutions[r.line] ?? "skip")}
                    onChange={(e) =>
                      setResolutions({ ...resolutions, [r.line]: readChoice(e.target.value) })
                    }
                  >
                    {choices(r).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => call(false, mapping)}
              className="min-h-11"
            >
              Dry run again
            </Button>
            <Button disabled={pending} onClick={() => call(true, mapping)} className="min-h-11">
              Apply
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
