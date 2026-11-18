import { z } from "zod";

// What a member may change about themselves (spec F1). Strict: status, payment status and
// anything else not listed is refused, not silently ignored (spec F2).

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();
const instant = z.coerce.date().nullable();

export const availabilityWindowInput = z.strictObject({
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  kind: z.enum(["available", "unavailable"]).default("available"),
  note: text(200).optional(),
});

export const profileInput = z
  .strictObject({
    displayName: z.string().trim().min(1).max(80),
    playaName: text(60),
    pronouns: text(30),
    bio: text(600),
    phone: text(30),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code")
      .transform((v) => v.toUpperCase())
      .nullable(),
    firstBurnYear: z.number().int().min(1990).max(2100).nullable(),
    emergencyContactName: text(80),
    emergencyContactPhone: text(30),
    directoryVisibility: z.enum(["hidden", "members", "members_with_contact"]),
    arrivalAt: instant,
    departureAt: instant,
    earlyLeaveReason: text(200),
    buildCommitment: z.enum(["none", "partial", "full"]),
    strikeCommitment: z.enum(["none", "partial", "full"]),
    tentChoice: z.enum(["camp_dome", "large_bell", "byo_tent", "caravan_or_car", "undecided"]),
    diet: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian", "other"]).nullable(),
    allergies: text(300),
    availabilityNote: text(300),
    skills: z.array(z.string().max(40)).max(30),
    availabilityWindows: z.array(availabilityWindowInput).max(20),
  })
  .partial();

export type ProfileInput = z.input<typeof profileInput>;
export type ProfilePatch = z.output<typeof profileInput>;

/** Columns on `people` vs `edition_members`, keyed by the input field name. */
export const PERSON_FIELDS = {
  displayName: "displayName",
  playaName: "playaName",
  pronouns: "pronouns",
  bio: "bio",
  phone: "phoneE164",
  countryCode: "countryCode",
  firstBurnYear: "firstBurnYear",
  emergencyContactName: "emergencyContactName",
  emergencyContactPhone: "emergencyContactPhone",
  directoryVisibility: "directoryVisibility",
} as const;

export const MEMBER_FIELDS = {
  arrivalAt: "arrivalAt",
  departureAt: "departureAt",
  earlyLeaveReason: "earlyLeaveReason",
  buildCommitment: "buildCommitment",
  strikeCommitment: "strikeCommitment",
  tentChoice: "tentChoice",
  diet: "diet",
  allergies: "allergies",
  availabilityNote: "availabilityNote",
} as const;

/** Never written to logs or audit values (AGENTS.md rule 7). The audit records that they changed. */
export const REDACTED_FIELDS: ReadonlySet<string> = new Set([
  "phone",
  "emergencyContactName",
  "emergencyContactPhone",
  "diet",
  "allergies",
]);
