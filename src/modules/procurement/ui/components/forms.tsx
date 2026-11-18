"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importCsv } from "../../server/stock";

export function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string, then?: (r: unknown) => void) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (isActionFailure(r)) {
          setMsg(r.error);
          return;
        }
        setMsg(done);
        if (then) then(r);
        else router.refresh();
      } catch (e) {
        setMsg(
          e instanceof Error && e.name === "ValidationError"
            ? e.message
            : "That didn't work. Check the details, or you may not be allowed to do this.",
        );
      }
    });
  };
  return { msg, setMsg, pending, run, router };
}

export function Status({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="status" className="text-sm">
      {msg}
    </p>
  ) : null;
}

export function Form(props: {
  onSubmit: (f: FormData, submitter: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={props.className ?? "flex flex-col gap-2"}
      onSubmit={(e) => {
        e.preventDefault();
        const via = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        props.onSubmit(new FormData(e.currentTarget), via?.value ?? "");
      }}
    >
      {props.children}
    </form>
  );
}

export const field = "min-h-11";
export const select = "min-h-11 rounded-md border bg-card px-2";
export const area = "rounded-md border bg-card p-2";
export const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Leads paste or pick last year's tool list (P7). Bad rows are listed, nothing is guessed. */
export function CsvImportForm() {
  const { msg, setMsg, pending, run } = useAction();
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <Form
      onSubmit={(f) => {
        setErrors([]);
        const file = f.get("file");
        run(async () => {
          const text = file instanceof File && file.size ? await file.text() : s(f, "text");
          const r = await importCsv({ text });
          if (isActionFailure(r)) return r;
          if (!r.ok) {
            setErrors(r.errors.map((e) => `Line ${e.line}: ${e.message}`));
            throw Object.assign(new Error("Nothing imported. Fix the rows below."), {
              name: "ValidationError",
            });
          }
          setMsg(`Imported ${r.imported} rows.`);
          return r;
        }, "Imported.");
      }}
    >
      <Label htmlFor="csv-file">Import a tool list (CSV)</Label>
      <p className="text-xs text-muted-foreground">
        Columns: name, category, unit, quantity, location, condition. New items and places are
        added; counts are logged.
      </p>
      <input id="csv-file" name="file" type="file" accept=".csv,text/csv" className="text-sm" />
      <Label htmlFor="csv-text" className="sr-only">
        Or paste the CSV
      </Label>
      <textarea
        id="csv-text"
        name="text"
        rows={3}
        className={area}
        placeholder="Staple gun,tool,pcs,2,Container A,good"
      />
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        Import
      </Button>
      <Status msg={msg} />
      {errors.length ? (
        <ul className="text-sm text-rust">
          {errors.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </Form>
  );
}
