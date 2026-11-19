import type { ModuleSeedContext } from "@/base/api";
import { activeEvent, activeKeys } from "@/lib/active-packs";
import { campInputToInstant } from "@/lib/dates";
import { createObligation, type NewObligation } from "./server/create";

const AB = "https://www.afrikaburn.org";
const QP = "https://quaggapedia.afrikaburn.com/index.php?title=";
const BRC = "https://burningman.org/black-rock-city";
const BMHELP = "https://help.burningman.org/hc/en-us/articles";
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
  // Burning Man Placement (plan Phase 2): the camp-lead year, tracked like any other deadline.
  {
    key: "bm_statement_of_intent",
    title: "Statement of Intent (Placement)",
    authority: "burning_man",
    category: "registration",
    prev: "2026-01-15",
    owner: "admin",
    sourceUrl: `${BMHELP}/4410598647316-Theme-Camp-Statement-of-Intent-SOI-and-Stewards-Sale-Tickets`,
    sourceDocSlug: "bm-statement-of-intent",
    requiredDocuments: ["Camp description", "Camp size and dimensions", "Camp contacts"],
    notes: "Filed in Burner Profile. Placed camps need it for Stewards Sale tickets.",
  },
  {
    key: "bm_stewards_sale",
    title: "Stewards Sale ticket list",
    authority: "burning_man",
    category: "tickets",
    prev: "2026-02-26",
    owner: "lead",
    sourceUrl: `${BMHELP}/34445848189076-What-is-the-Stewards-Sale-Who-is-eligible`,
    sourceDocSlug: "bm-stewards-sale",
    requiredDocuments: ["Who gets a Stewards ticket"],
  },
  {
    key: "bm_placement_questionnaire",
    title: "Placement questionnaire",
    authority: "burning_man",
    category: "registration",
    prev: "2026-03-19",
    owner: "admin",
    sourceUrl: `${BRC}/camps/placement-process/`,
    sourceDocSlug: "bm-placement-process",
    requiredDocuments: ["Site plan", "Interactivity and frontage", "Sound and power plan"],
  },
  {
    key: "bm_setup_access_passes",
    title: "Setup Access Pass request",
    authority: "burning_man",
    category: "wap",
    prev: "2026-04-16",
    owner: "lead",
    sourceUrl: `${BMHELP}/4415067257236-Setup-Access-Passes`,
    sourceDocSlug: "bm-setup-access-passes",
    requiredDocuments: ["Build crew list"],
  },
  {
    key: "bm_leave_no_trace",
    title: "MOOP sweep and Leave No Trace before Exodus",
    authority: "burning_man",
    category: "lnt",
    prev: "2026-09-08",
    sourceUrl: `${BRC}/preparation/getting-there-and-back/exodus/`,
    sourceDocSlug: "bm-exodus",
    notes: "Line-sweep the site; the MOOP Map grades the camp and counts toward standing.",
  },
  {
    key: "bm_post_playa_report",
    title: "Post-playa Report",
    authority: "burning_man",
    category: "exit_signoff",
    prev: "2026-10-15",
    owner: "admin",
    sourceUrl: `${BRC}/camps/placement-process/`,
    sourceDocSlug: "bm-post-playa-report",
    notes: "Due after the event; Placement reads it for next year's standing.",
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
  const intent =
    activeEvent.key === "burning-man"
      ? {
          title: "Tell Placement we're coming back (camp leads' check-in)",
          authority: "burning_man" as const,
          sourceUrl: `${BRC}/camps/placement-process/`,
        }
      : {
          title: "Tell AfrikaBurn we're coming back (intent form)",
          authority: "afrikaburn" as const,
          sourceUrl: `${AB}/event/participation/theme-camps/`,
        };
  await createObligation(tasks, db, edition, {
    key: "camp_intent_form",
    ...intent,
    category: "registration",
    dueAt: new Date(now - 3 * 86_400_000),
    dateConfirmed: true,
    ownerPersonId: people.member,
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
