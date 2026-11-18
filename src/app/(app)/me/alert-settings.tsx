"use client";
import { saveNotificationPreference } from "@/base/engine/server/actions";
import { ActionForm } from "../_components/action-form";
import { CHANNEL_CHOICES, typeLabel } from "../tasks/task-view";

type Channel = (typeof CHANNEL_CHOICES)[number]["value"];
type Input = { type: string; channel: Channel };

/** Every row of the form → one preference per kind; refuses a channel that isn't on the list. */
export function readAlertSettings(
  types: readonly string[],
  get: (key: string) => string,
): { ok: true; inputs: Input[] } | { ok: false; error: string } {
  const inputs: Input[] = [];
  for (const type of types) {
    const channel = CHANNEL_CHOICES.find((c) => c.value === get(`channel-${type}`))?.value;
    if (!channel)
      return { ok: false, error: `Pick how you want to hear about ${typeLabel(type)}.` };
    inputs.push({ type, channel });
  }
  return { ok: true, inputs };
}

/** My profile → Alert settings (spec B3.2): set once, so one compact form with one Save. */
export function AlertSettings({ prefs }: { prefs: { type: string; channel: string }[] }) {
  const types = prefs.map((p) => p.type);
  return (
    <ActionForm
      label="Save alert settings"
      done="Alert settings saved."
      read={async (f) => {
        const r = readAlertSettings(types, (k) => String(f.get(k) ?? ""));
        if (!r.ok) return r;
        for (const input of r.inputs) {
          const saved = await saveNotificationPreference(input);
          if (!saved.ok) return saved;
        }
        return { ok: true };
      }}
    >
      <ul className="flex flex-col divide-y divide-border/70 rounded-2xl border bg-card">
        {prefs.map((p) => (
          <li key={p.type} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <label htmlFor={`channel-${p.type}`} className="text-sm">
              {typeLabel(p.type)}
            </label>
            <select
              id={`channel-${p.type}`}
              name={`channel-${p.type}`}
              defaultValue={p.channel}
              className="min-h-11 rounded-md border bg-background px-2 text-sm"
            >
              {CHANNEL_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </ActionForm>
  );
}
