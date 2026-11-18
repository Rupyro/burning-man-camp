import type { ModuleSeedContext } from "@/base/api";
import { activeKeys } from "@/lib/active-packs";
import { campInputToInstant } from "@/lib/dates";
import { createObligation, type NewObligation } from "./server/create";

const AB = "https://www.afrikaburn.org";
const QP = "https://quaggapedia.afrikaburn.com/index.php?title=";
/** 2027 guess = the 2026 date a year on, noon camp time. Marked tentative (dateConfirmed false). */
const guess = (d2026: string) => campInputToInstant(d2026.replace(/^2026/, "2027"), "12:00");

type Seed = Omit<NewObligation, "ownerPersonId" | "dueAt"> & {
  owner?: "admin" | "lead" | "member";
  /** 2026 date; the 2027 due date is guessed from it. */
  prev?: string;
};

/** PLAN.md "Module: Obligations": the AfrikaBurn duties, 2026 dates marked tentative. */
const OBLIGATIONS: Seed[] = [
  {
    key: "theme_camp_registration",
    title: "Theme camp registration",
    authority: "afrikaburn",
    category: "registration",
    prev: "2026-02-28",
    owner: "admin",
    sourceUrl: `${AB}/event/participation/theme-camps/theme-camps-guide/`,
    sourceDocSlug: "theme-camps-guide",
    requiredDocuments: ["Camp description", "Placement request", "Size and layout"],
  },
  {
    key: "wap_requests",
    title: "WAP (early-arrival pass) requests",
    authority: "afrikaburn",
    category: "wap",
    prev: "2026-03-15",
    owner: "lead",
    sourceUrl: `${AB}/event/participation/theme-camps/`,
    sourceDocSlug: "theme-camps",
    requiredDocuments: ["Builder list (name + email)"],
  },
  {
    key: "mv_registration",
    title: "Mutant vehicle registration",
    authority: "dmv",
    category: "mutant_vehicle",
    prev: "2026-04-05",
    sourceUrl: `${AB}/event/participation/mutant-vehicles/`,
    sourceDocSlug: "mutant-vehicles",
    requiredDocuments: ["Vehicle photos", "Driver register"],
    notes: 'Art car. Owner still to be named (the 2026 list said "????????").',
  },
  {
    key: "dmv_flame_licensing",
    title: "DMV licensing and flame-effect plan",
    authority: "dmv",
    category: "mutant_vehicle",
    prev: "2026-04-05",
    sourceUrl: `${AB}/wp-content/uploads/2026/09/2027-FLAME-EFFECTS.docx-1.pdf`,
    sourceDocSlug: "dmv-flame-effects-guidelines-2027-pdf",
    requiredDocuments: ["Flame-effect plan", "Emergency plan"],
    notes: "Use the 2027 flame guidelines (20–30 m distances), not the 2019 ones.",
  },
  {
    key: "sound_plan",
    title: "Sound plan and Sound Officer",
    authority: "sound_team",
    category: "sound",
    prev: "2026-03-31",
    owner: "member",
    sourceUrl: `${AB}/afrikaburn-sound-policy/`,
    sourceDocSlug: "afrikaburn-sound-policy",
    requiredDocuments: ["Sound Officer name", "Art car stops and times"],
  },
  {
    key: "lnt_plan",
    title: "Leave No Trace plan and LNT lead",
    authority: "afrikaburn",
    category: "lnt",
    prev: "2026-03-31",
    sourceUrl: `${AB}/afrikaburn-artwork-moop-policy-leave-no-trace/`,
    sourceDocSlug: "afrikaburn-artwork-moop-policy-leave-no-trace",
    requiredDocuments: ["LNT lead name", "Greywater plan"],
  },
  {
    key: "fire_safety",
    title: "Fire safety officer and extinguishers",
    authority: "afrikaburn",
    category: "fire_safety",
    prev: "2026-04-10",
    owner: "admin",
    sourceUrl: `${AB}/binnekringblog/fire-safety-in-your-camp/`,
    sourceDocSlug: "fire-safety-in-your-camp",
    requiredDocuments: ["Fire safety officer name", "Extinguisher count"],
    notes: "Sources give 4 extinguisher formulas; plan for the strictest.",
  },
  {
    key: "gas_fuel",
    title: "Gas and fuel storage limits",
    authority: "fuel_team",
    category: "gas_fuel",
    prev: "2026-04-10",
    sourceUrl: `${AB}/afrikaburn-gas-and-fuel-storage-policy/`,
    sourceDocSlug: "afrikaburn-gas-and-fuel-storage-policy",
    notes:
      "Limits conflict between sources (100 kg vs 90 kg vs 19 kg gas; 40 L vs 50 L fuel). Ask the Fuel team.",
  },
  {
    key: "water_ice_orders",
    title: "Water and ice orders",
    authority: "supplier_depot",
    category: "water_ice",
    prev: "2026-04-12",
    owner: "lead",
    sourceUrl: `${QP}SUPPLIER_DEPOT`,
    sourceDocSlug: "quaggapedia-supplier-depot",
  },
  {
    key: "food_safety_form",
    title: "Food Safety Form (only if gifting food)",
    authority: "afrikaburn",
    category: "food_safety",
    prev: "2026-04-01",
    sourceUrl: `${AB}/event/participation/theme-camps/theme-camp-safety-checklist/`,
    sourceDocSlug: "theme-camp-safety-checklist",
  },
  {
    key: "supplier_registration",
    title: "Supplier registration",
    authority: "supplier_depot",
    category: "supplier",
    prev: "2026-03-20",
    sourceUrl: `${AB}/suppliers/supplier-registration/`,
    sourceDocSlug: "supplier-registration",
  },
  {
    key: "exit_lnt_signoff",
    title: "Final LNT sign-off at exit",
    authority: "afrikaburn",
    category: "exit_signoff",
    prev: "2026-05-04",
    sourceUrl: `${QP}LEAVE_NO_TRACE`,
    sourceDocSlug: "quaggapedia-leave-no-trace",
    notes: "Camp isn't done until the LNT team signs off the site.",
  },
];

/** Fake, deterministic, idempotent (each key once per edition). Two demo extras show states. */
export async function seed({ db, edition, people, tasks }: ModuleSeedContext) {
  const on = activeKeys("obligations");
  for (const o of OBLIGATIONS.filter((x) => on.has(x.key))) {
    const { owner, prev, ...rest } = o;
    await createObligation(tasks, db, edition, {
      ...rest,
      previousYearDate: prev ?? null,
      dueAt: prev ? guess(prev) : null,
      ownerPersonId: owner ? people[owner] : null,
    });
  }
  // Demo variety (dates relative to the first seed): one late internal check, one already done.
  const now = Date.now();
  await createObligation(tasks, db, edition, {
    key: "camp_intent_form",
    title: "Tell AfrikaBurn we're coming back (intent form)",
    authority: "afrikaburn",
    category: "registration",
    dueAt: new Date(now - 3 * 86_400_000),
    dateConfirmed: true,
    ownerPersonId: people.member,
    sourceUrl: `${AB}/event/participation/theme-camps/`,
  });
  const done = await createObligation(tasks, db, edition, {
    key: "nominate_officers",
    title: "Name the 2027 officers (LNT, fire, sound, MV)",
    authority: "internal",
    category: "other",
    dueAt: new Date(now - 10 * 86_400_000),
    dateConfirmed: true,
    ownerPersonId: people.admin,
  });
  if (done) await tasks.update(done.taskId, { status: "done" });
}
