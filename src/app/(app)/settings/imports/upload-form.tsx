"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadBatch } from "@/base/ingest/server/actions";
import { Button } from "@/components/ui/button";

const KINDS = [
  { key: "tools", label: "Tool list" },
  { key: "members", label: "Members" },
  { key: "family", label: "Family years" },
] as const;

export function UploadForm() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("tools");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is in the sheet">
        {KINDS.map((k) => (
          <Button
            key={k.key}
            type="button"
            variant={kind === k.key ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={kind === k.key}
            onClick={() => setKind(k.key)}
          >
            {k.label}
          </Button>
        ))}
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setMessage(null);
          start(async () => {
            const r = await uploadBatch({ kind, fileName: file.name, csv: await file.text() });
            if (r.ok) router.push(`/settings/imports/${r.data}`);
            else setMessage(r.error);
          });
        }}
      />
      {pending ? <p className="text-sm">Checking the sheet…</p> : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
