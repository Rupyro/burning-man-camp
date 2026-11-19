// Oe-aa-sies camp settings. Another camp copies the repo and swaps these values (and camp-art/).
// Run `pnpm camp:setup` to answer 7 questions and rewrite this file, or edit it by hand.
import { defineCampConfig } from "./src/lib/camp-config";

export default defineCampConfig({
  camp: {
    name: "Oe-aa-sies",
    shortName: "Oe-aa-sies",
    slug: "oeaasies",
    tagline: "Operations platform for the Oe-aa-sies camp at AfrikaBurn",
    packs: ["core", "sound", "mutant-vehicle", "power"],
  },
  look: { logo: "/backdrop/logomark.png", emblem: "protea" },
  money: { currency: "ZAR", symbol: "R", campFeeCents: 350_000, xceed: { enabled: false } },
  joining: { familyYears: { enabled: true, since: 2023 } },
  extras: { traditions: ["rain-dance"] },
  event: { pack: "afrikaburn" },
  owners: {
    campKey: "ours",
    labels: {
      ours: "Ours",
      borrowed: "Borrowed",
      rented: "Rented",
    },
  },
});
