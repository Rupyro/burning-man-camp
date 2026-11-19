"use client";
import { saveAnchorDate, saveEdition } from "@/base/people/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMP_TZ_LABEL } from "@/lib/dates";
import { ActionForm } from "../_components/action-form";
import { type AnchorInitial, readAnchorForm, readEditionForm } from "./anchor-input";

const getter = (f: FormData) => (k: string) => String(f.get(k) ?? "");

function Field(p: { name: string; sfx: string; label: string; type?: string; value?: string }) {
  const id = `${p.name}${p.sfx}`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{p.label}</Label>
      <Input id={id} name={p.name} type={p.type} defaultValue={p.value} className="min-h-11" />
    </div>
  );
}

export function EditionForm(p: { title: string; capacity: number | null }) {
  return (
    <ActionForm label="Save" read={(f) => saveEdition(readEditionForm(getter(f)))}>
      <Field name="title" sfx="" label="Title" value={p.title} />
      <Field
        name="capacity"
        sfx=""
        label="Member capacity"
        type="number"
        value={String(p.capacity ?? 70)}
      />
    </ActionForm>
  );
}

/** Add a key date (initial = null) or edit one (its key stays fixed). */
export function AnchorForm({ initial }: { initial: AnchorInitial | null }) {
  const sfx = `-${initial?.key ?? "new"}`;
  return (
    <ActionForm
      label={initial ? "Save date" : "Add date"}
      read={async (f) => {
        const r = readAnchorForm(getter(f), initial?.key);
        return r.ok ? saveAnchorDate(r.input) : r;
      }}
    >
      {initial ? null : <Field name="key" sfx={sfx} label="Key (e.g. build_start, lowercase)" />}
      <Field name="label" sfx={sfx} label="Label" value={initial?.label} />
      <Field
        name="startDate"
        sfx={sfx}
        label="Starts (date)"
        type="date"
        value={initial?.start.date}
      />
      <Field
        name="startTime"
        sfx={sfx}
        label={`Starts (time, ${CAMP_TZ_LABEL})`}
        type="time"
        value={initial?.start.time}
      />
      <Field
        name="endDate"
        sfx={sfx}
        label="Ends (date, optional)"
        type="date"
        value={initial?.end?.date}
      />
      <Field
        name="endTime"
        sfx={sfx}
        label={`Ends (time, ${CAMP_TZ_LABEL})`}
        type="time"
        value={initial?.end?.time}
      />
      <Field
        name="sourceNote"
        sfx={sfx}
        label="Source note (optional)"
        value={initial?.sourceNote}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isConfirmed" defaultChecked={initial?.isConfirmed} />
        Confirmed (untick = TBC)
      </label>
    </ActionForm>
  );
}
