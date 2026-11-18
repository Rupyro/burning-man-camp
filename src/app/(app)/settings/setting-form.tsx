"use client";
import { saveAutomationSetting } from "@/base/settings/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionForm } from "../_components/action-form";

export interface SettingRow {
  key: string;
  kind: "onoff" | "days" | "rand";
  label: string;
  help: string;
  value: number;
  defaultValue: number;
}

const shown = (s: { kind: SettingRow["kind"]; value: number }) =>
  s.kind === "rand" ? String(s.value / 100) : String(s.value);

/** One setting: a short explanation, the value, and Save. Rand amounts are typed in whole rand. */
export function SettingForm({ s }: { s: SettingRow }) {
  const id = `setting-${s.key}`;
  return (
    <ActionForm
      label="Save"
      read={(f) => {
        const raw = String(f.get("value") ?? "");
        const n = s.kind === "onoff" ? (raw === "1" ? 1 : 0) : Number(raw);
        if (raw.trim() === "" || !Number.isFinite(n))
          return Promise.resolve({ ok: false as const, error: "Type a number" });
        return saveAutomationSetting({
          key: s.key,
          value: s.kind === "rand" ? Math.round(n * 100) : Math.round(n),
        });
      }}
    >
      <Label htmlFor={id} className="font-semibold">
        {s.label}
      </Label>
      <p className="text-sm text-muted-foreground">{s.help}</p>
      {s.kind === "onoff" ? (
        <select
          id={id}
          name="value"
          defaultValue={String(s.value)}
          className="min-h-11 rounded-md border bg-background px-3 text-sm"
        >
          <option value="1">On</option>
          <option value="0">Off</option>
        </select>
      ) : (
        <div className="flex items-center gap-2">
          {s.kind === "rand" ? <span className="text-sm">R</span> : null}
          <Input
            id={id}
            name="value"
            type="number"
            inputMode="numeric"
            defaultValue={shown(s)}
            className="min-h-11 w-32"
          />
          {s.kind === "days" ? <span className="text-sm">days</span> : null}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Starting value:{" "}
        {s.kind === "onoff"
          ? s.defaultValue
            ? "On"
            : "Off"
          : shown({ ...s, value: s.defaultValue })}
        {s.kind === "days" ? " days" : ""}
      </p>
    </ActionForm>
  );
}
