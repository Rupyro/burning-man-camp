"use client";
import { saveMyProfile } from "@/base/people/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionForm } from "../_components/action-form";

const TEXT: [string, string][] = [
  ["displayName", "Name"],
  ["playaName", "Playa name"],
  ["pronouns", "Pronouns"],
  ["phone", "Phone"],
  ["countryCode", "Country (2 letters)"],
  ["emergencyContactName", "Emergency contact name"],
  ["emergencyContactPhone", "Emergency contact phone"],
  ["allergies", "Allergies"],
  ["availabilityNote", "Availability note"],
  ["bio", "About you"],
];
const CHOICE: [string, string, string[]][] = [
  ["directoryVisibility", "Who sees you", ["members", "members_with_contact", "hidden"]],
  ["buildCommitment", "Build", ["none", "partial", "full"]],
  ["strikeCommitment", "Strike", ["none", "partial", "full"]],
  ["tentChoice", "Tent", ["undecided", "camp_dome", "large_bell", "byo_tent", "caravan_or_car"]],
  ["diet", "Diet", ["", "omnivore", "vegetarian", "vegan", "pescatarian", "other"]],
];

function toPatch(f: FormData) {
  const patch: Record<string, unknown> = {};
  for (const [k] of TEXT) {
    const v = String(f.get(k) ?? "").trim();
    patch[k] = k === "displayName" ? v : v || null;
  }
  for (const [k] of CHOICE) patch[k] = String(f.get(k) ?? "") || null;
  for (const k of ["arrivalAt", "departureAt"]) {
    const v = String(f.get(k) ?? "");
    patch[k] = v ? `${v}T12:00:00Z` : null;
  }
  patch.skills = f.getAll("skills").map(String);
  return patch;
}

export function ProfileForm(p: {
  initial: Record<string, string>;
  skills: string[];
  catalogue: { key: string; label: string }[];
}) {
  return (
    <ActionForm label="Save profile" read={(f) => saveMyProfile({ patch: toPatch(f) })}>
      {TEXT.map(([k, label]) => (
        <div key={k} className="flex flex-col gap-1">
          <Label htmlFor={k}>{label}</Label>
          <Input id={k} name={k} defaultValue={p.initial[k]} className="min-h-11" />
        </div>
      ))}
      {CHOICE.map(([k, label, options]) => (
        <div key={k} className="flex flex-col gap-1">
          <Label htmlFor={k}>{label}</Label>
          <select
            id={k}
            name={k}
            defaultValue={p.initial[k]}
            className="min-h-11 rounded-md border px-2"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o ? o.replaceAll("_", " ") : "prefer not to say"}
              </option>
            ))}
          </select>
        </div>
      ))}
      {(["arrivalAt", "departureAt"] as const).map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <Label htmlFor={k}>{k === "arrivalAt" ? "Arrival day" : "Departure day"}</Label>
          <Input id={k} name={k} type="date" defaultValue={p.initial[k]} className="min-h-11" />
        </div>
      ))}
      <fieldset className="flex flex-wrap gap-3">
        <legend className="text-sm font-medium">Skills</legend>
        {p.catalogue.map((s) => (
          <label key={s.key} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="skills"
              value={s.key}
              defaultChecked={p.skills.includes(s.label)}
            />
            {s.label}
          </label>
        ))}
      </fieldset>
    </ActionForm>
  );
}
