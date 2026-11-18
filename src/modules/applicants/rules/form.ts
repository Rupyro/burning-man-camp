// The PLACEHOLDER application form (spec applicants §3). Ruchir will send the real one; until then
// these questions stand in. Pure: no db, no next.
import { hasPack } from "@/lib/active-packs";
import { CAMP_NAME } from "@/lib/camp";

/** Examples in the "help with" question; "art car" only for camps with the mutant vehicle pack. */
const HELP_HINTS = [
  "build",
  "kitchen",
  hasPack("mutant-vehicle") ? "art car" : "",
  "MOOP",
  "workshops",
].filter(Boolean);

export interface FormField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "choice";
  required: boolean;
  max: number;
  options?: readonly string[];
  hint?: string;
}

export const FORM_FIELDS: readonly FormField[] = [
  {
    key: "playa_name",
    label: "Playa name (if you have one)",
    kind: "text",
    required: false,
    max: 60,
  },
  { key: "country", label: "Where are you based?", kind: "text", required: true, max: 60 },
  {
    key: "burns",
    label: "Have you been to AfrikaBurn or another burn?",
    kind: "choice",
    required: true,
    max: 40,
    options: ["First burn", "1–2 burns", "3 or more"],
  },
  {
    key: "why",
    label: `Why do you want to join ${CAMP_NAME}?`,
    kind: "textarea",
    required: true,
    max: 1500,
    hint: "A few sentences is plenty.",
  },
  {
    key: "contribute",
    label: `What would you like to help with? (${HELP_HINTS.join(", ")}…)`,
    kind: "textarea",
    required: true,
    max: 1000,
  },
  {
    key: "build_strike",
    label: "Can you come early for build or stay for strike?",
    kind: "choice",
    required: true,
    max: 40,
    options: ["Build", "Strike", "Both", "Neither"],
  },
  {
    key: "heard_from",
    label: "How did you hear about us?",
    kind: "text",
    required: false,
    max: 200,
  },
];

export type Answers = Record<string, string>;

/**
 * Clean the answers (trim, drop unknown keys). With `submit`, every required question must be
 * answered; a draft may be partly empty. Errors are per question key.
 */
export function validateAnswers(
  raw: Record<string, unknown>,
  submit: boolean,
): { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  for (const f of FORM_FIELDS) {
    const v = typeof raw[f.key] === "string" ? (raw[f.key] as string).trim() : "";
    if (v.length > f.max) errors[f.key] = `Keep it under ${f.max} characters`;
    else if (v && f.options && !f.options.includes(v)) errors[f.key] = "Pick one of the options";
    else if (submit && f.required && !v) errors[f.key] = "Please answer this one";
    if (v) answers[f.key] = v.slice(0, f.max);
  }
  return { answers, errors };
}
