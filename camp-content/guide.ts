// The camp's guide text (camp info page and "Ask the guide"). Another camp swaps this file.
import { CAMP_NAME } from "../src/lib/camp";

/** Draft text the leads will replace with the camp's own guide. */
export const CAMP_GUIDE = {
  guide: [
    `${CAMP_NAME} is a theme camp: everyone pitches in on build, kitchen, MOOP and strike.`,
    "Your tasks and approvals show up in Up next on the home screen. Do them before they're late.",
    "Stuck or can't make something? Tell your team lead early, so it doesn't become someone else's emergency.",
  ],
  packing: [
    "Water: at least 1.5 gallons a day for yourself, plus your share for the camp",
    "Shelter that survives wind: tent or shade, rebar or lag-bolt stakes, ratchet straps",
    "Dust gear: goggles, dust mask, lip balm, wet wipes",
    "Warm layers for cold nights, and a headlamp with spare batteries",
    "Your MOOP bag: everything you bring goes home with you",
  ],
  rules: [
    "Leave no trace: pick up MOOP (matter out of place) wherever you see it",
    "Turn up for your shifts, or arrange a swap in good time",
    "Respect quiet hours and other people's tents",
    "Look after each other: water, shade and a friendly check-in",
    "Read the Burning Man Survival Guide before you travel",
  ],
} as const;
