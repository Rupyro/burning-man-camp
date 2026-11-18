// Header mapping and value normalising for the member CSV import (spec I1, I2). Pure.

export const IMPORT_FIELDS = {
  email: { label: "Email", aliases: ["email", "e-mail", "email address", "mail"] },
  fullName: { label: "Full name", aliases: ["name", "full name", "your name"] },
  firstName: {
    label: "First name",
    aliases: ["first name", "first", "given name", "name (first)"],
  },
  lastName: { label: "Last name", aliases: ["last name", "surname", "family name", "last"] },
  playaName: { label: "Playa name", aliases: ["playa name", "burner name", "nickname"] },
  phone: { label: "Phone", aliases: ["phone", "cell", "mobile", "whatsapp", "phone number"] },
  countryCode: { label: "Country (2 letters)", aliases: ["country", "country code"] },
  status: { label: "Member status", aliases: ["status", "member status", "confirmed"] },
  paymentStatus: {
    label: "Payment status",
    aliases: ["payment", "payment status", "deposit", "paid", "deposit / payment", "fees"],
  },
  arrivalAt: { label: "Arrival", aliases: ["arrival", "arrival date", "arriving", "arrive"] },
  departureAt: { label: "Departure", aliases: ["departure", "departure date", "leaving"] },
  buildCommitment: {
    label: "Build",
    aliases: ["build", "build week", "build crew", "build week?"],
  },
  strikeCommitment: { label: "Strike", aliases: ["strike", "strike crew", "strike?"] },
  tentChoice: { label: "Tent", aliases: ["tent", "tent choice", "accommodation", "shelter"] },
  diet: { label: "Diet", aliases: ["diet", "dietary", "dietary requirements", "diet type"] },
  allergies: { label: "Allergies", aliases: ["allergies", "allergy", "food allergies"] },
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;
export type Mapping = (ImportField | null)[];

const clean = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

/** One field per column, from the header text; each field is used at most once. */
export function guessMapping(headers: readonly string[]): Mapping {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const name = clean(h);
    const hit = (Object.keys(IMPORT_FIELDS) as ImportField[]).find(
      (f) => !used.has(f) && (IMPORT_FIELDS[f].aliases as readonly string[]).includes(name),
    );
    if (!hit) return null;
    used.add(hit);
    return hit;
  });
}

const STATUS: Record<string, string> = {
  confirmed: "confirmed",
  yes: "confirmed",
  accepted: "confirmed",
  waitlisted: "waitlisted",
  waitlist: "waitlisted",
  "wait list": "waitlisted",
  prospect: "prospect",
  interested: "prospect",
  applied: "prospect",
  withdrawn: "withdrawn",
  cancelled: "withdrawn",
  "dropped out": "withdrawn",
  removed: "removed",
};
const PAYMENT: Record<string, string> = {
  unknown: "unknown",
  "": "unknown",
  no: "unknown",
  unpaid: "unknown",
  deposit: "deposit_paid",
  "deposit paid": "deposit_paid",
  deposit_paid: "deposit_paid",
  paid: "paid_in_full",
  "paid in full": "paid_in_full",
  "fully paid": "paid_in_full",
  paid_in_full: "paid_in_full",
  waived: "waived",
  comp: "waived",
  overdue: "overdue",
  late: "overdue",
};
const COMMIT: Record<string, string> = {
  yes: "full",
  y: "full",
  full: "full",
  true: "full",
  partial: "partial",
  some: "partial",
  "part time": "partial",
  maybe: "partial",
  no: "none",
  n: "none",
  none: "none",
  false: "none",
};
const TENT: Record<string, string> = {
  dome: "camp_dome",
  "camp dome": "camp_dome",
  camp_dome: "camp_dome",
  bell: "large_bell",
  "bell tent": "large_bell",
  "large bell": "large_bell",
  large_bell: "large_bell",
  own: "byo_tent",
  byo: "byo_tent",
  "own tent": "byo_tent",
  "bring my own tent": "byo_tent",
  byo_tent: "byo_tent",
  caravan: "caravan_or_car",
  car: "caravan_or_car",
  "caravan or car": "caravan_or_car",
  caravan_or_car: "caravan_or_car",
  undecided: "undecided",
  "not sure": "undecided",
};
const DIET: Record<string, string> = {
  omnivore: "omnivore",
  none: "omnivore",
  "no restrictions": "omnivore",
  everything: "omnivore",
  vegetarian: "vegetarian",
  veg: "vegetarian",
  veggie: "vegetarian",
  vegan: "vegan",
  pescatarian: "pescatarian",
  pescetarian: "pescatarian",
  other: "other",
};

export interface NormalisedRow {
  values: {
    email?: string;
    displayName?: string;
    legalFirstName?: string;
    legalLastName?: string;
    playaName?: string;
    phoneE164?: string;
    countryCode?: string;
    status?: "prospect" | "waitlisted" | "confirmed" | "withdrawn" | "removed";
    paymentStatus?: "unknown" | "deposit_paid" | "paid_in_full" | "waived" | "overdue";
    arrivalAt?: Date;
    departureAt?: Date;
    buildCommitment?: "none" | "partial" | "full";
    strikeCommitment?: "none" | "partial" | "full";
    tentChoice?: "camp_dome" | "large_bell" | "byo_tent" | "caravan_or_car" | "undecided";
    diet?: "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "other";
    allergies?: string;
  };
  issues: string[];
}

function parseDate(v: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Turn one row's raw cells (by field) into typed values plus human-readable issues. */
export function normaliseRow(raw: Partial<Record<ImportField, string>>): NormalisedRow {
  const issues: string[] = [];
  const v: NormalisedRow["values"] = {};
  const cell = (f: ImportField) => raw[f]?.trim() ?? "";
  const pick = <T extends string>(f: ImportField, table: Record<string, string>, what: string) => {
    const c = cell(f);
    if (!c) return undefined;
    const hit = table[c.toLowerCase()];
    if (!hit) issues.push(`unknown ${what} "${c}"`);
    return hit as T | undefined;
  };

  const email = cell("email").toLowerCase();
  if (!email) issues.push("missing email");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("invalid email");
  else v.email = email;

  if (cell("firstName")) v.legalFirstName = cell("firstName");
  if (cell("lastName")) v.legalLastName = cell("lastName");
  if (cell("playaName")) v.playaName = cell("playaName");
  if (cell("phone")) v.phoneE164 = cell("phone").replace(/[\s()-]/g, "");
  if (cell("allergies")) v.allergies = cell("allergies");
  const country = cell("countryCode");
  if (country) {
    if (/^[a-z]{2}$/i.test(country)) v.countryCode = country.toUpperCase();
    else issues.push(`country should be a two-letter code, not "${country}"`);
  }
  v.status = pick("status", STATUS, "status");
  v.paymentStatus = pick("paymentStatus", PAYMENT, "payment status");
  for (const [f, key, label] of [
    ["arrivalAt", "arrivalAt", "arrival"],
    ["departureAt", "departureAt", "departure"],
  ] as const) {
    const c = cell(f);
    if (!c) continue;
    const d = parseDate(c);
    if (d) v[key] = d;
    else issues.push(`unreadable ${label} date "${c}"`);
  }
  v.buildCommitment = pick("buildCommitment", COMMIT, "build answer");
  v.strikeCommitment = pick("strikeCommitment", COMMIT, "strike answer");
  v.tentChoice = pick("tentChoice", TENT, "tent choice");
  v.diet = pick("diet", DIET, "diet");
  if (v.arrivalAt && v.departureAt && v.departureAt < v.arrivalAt)
    issues.push("departure is before arrival");

  const name =
    cell("fullName") || [v.legalFirstName, v.legalLastName].filter(Boolean).join(" ").trim();
  v.displayName = name || v.playaName || email.split("@")[0] || undefined;
  for (const k of Object.keys(v) as (keyof typeof v)[]) if (v[k] === undefined) delete v[k];
  return { values: v, issues };
}
