// AfrikaBurn (Tankwa Town, South Africa): the paperwork the original camp app was built around.
// Kept so a camp going to AfrikaBurn can still pick it; Burning Man is the default.
import { defineEventPack } from "../../src/lib/event-packs";

export default defineEventPack({
  key: "afrikaburn",
  label: "AfrikaBurn",
  place: "Tankwa Town, South Africa",
  coords: { lat: -32.33, lon: 19.75 },
  timezone: "Africa/Johannesburg",
  timezoneLabel: "SAST",
  dateStyle: "day-first",
  currency: "ZAR",
  water: { perPersonPerDay: 5, unit: "L" },
  year: 2027,
  calendar: [],
  words: {
    name: "AfrikaBurn",
    site: "Tankwa",
    principles: {
      title: "The 11 Principles of AfrikaBurn",
      body: "I've read the principles (radical inclusion, gifting, decommodification, self-reliance, self-expression, communal effort, civic responsibility, leave no trace, participation, immediacy, each one teach one).",
    },
    ticketPlan:
      "I understand the camp doesn't sell tickets. I'll get my own AfrikaBurn ticket through Quicket.",
    earlyPass: "WAP",
    directions: {
      label: "Directions on Quaggapedia",
      url: "https://quaggapedia.afrikaburn.com/index.php?title=GETTING_THERE_%26_DIRECTIONS",
    },
  },
  rules: [],
  obligations: [
    { key: "theme_camp_registration", label: "Theme camp registration" },
    { key: "wap_requests", label: "WAP (early-arrival pass) requests" },
    { key: "lnt_plan", label: "Leave No Trace plan and LNT lead" },
    { key: "fire_safety", label: "Fire safety officer and extinguishers" },
    { key: "water_ice_orders", label: "Water and ice orders" },
    { key: "food_safety_form", label: "Food Safety Form (only if gifting food)" },
    { key: "supplier_registration", label: "Supplier registration" },
    { key: "exit_lnt_signoff", label: "Final LNT sign-off at exit" },
    { key: "camp_intent_form", label: "Tell AfrikaBurn we're coming back (intent form)" },
    { key: "nominate_officers", label: "Name the 2027 officers (LNT, fire, sound, MV)" },
  ],
  sections: [{ key: "obligations", label: "AfrikaBurn duties" }],
});
