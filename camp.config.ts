// Your Camp camp settings. Another camp copies the repo and swaps these values (and camp-art/).
// Run `pnpm camp:setup` to answer 7 questions and rewrite this file, or edit it by hand.
import { defineCampConfig } from "./src/lib/camp-config";

export default defineCampConfig({
  camp: {
    name: "Your Camp",
    shortName: "Your Camp",
    slug: "yourcamp",
    tagline: "Operations platform for the Your Camp camp at Burning Man",
    packs: ["core", "sound", "mutant-vehicle", "power"],
    type: "theme",
    size: 70,
  },
  look: { logo: "/backdrop/logomark.png", emblem: "protea" },
  money: { currency: "USD", symbol: "$", campFeeCents: 45_000, xceed: { enabled: false } },
  joining: { familyYears: { enabled: true, since: 2023 } },
  extras: { traditions: [] },
  event: { pack: "burning-man" },
  // PLACEHOLDER rule, not Burning Man's: people who stay for the final sweep =
  // max(min, ceil(campers / perCampers)). The camp lead sets the real numbers.
  exodus: { sweepCrew: { min: 2, perCampers: 10 } },
  owners: {
    campKey: "ours",
    labels: {
      ours: "Ours",
      borrowed: "Borrowed",
      rented: "Rented",
    },
  },
});
