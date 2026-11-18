// Test camp preset: Lantern Crew, a 20-person art support camp (made-up camp, fake numbers).
// Try it: copy this file over camp.config.ts. The packs and type match the plan's example.
import { DEFAULT_OWNERS, defineCampConfig } from "../src/lib/camp-config";

export default defineCampConfig({
  camp: {
    name: "Lantern Crew",
    shortName: "Lantern",
    slug: "lanterncrew",
    tagline: "Build crew and support camp for the Lantern art project at Burning Man",
    packs: ["core", "art", "fire-flame", "kitchen"],
    type: "art-support",
    size: 20,
  },
  look: { logo: "/backdrop/logomark.png", emblem: "protea" },
  money: { currency: "USD", symbol: "$", campFeeCents: 30_000, xceed: { enabled: false } },
  joining: { familyYears: { enabled: false, since: 2027 } },
  extras: { traditions: [] },
  event: { pack: "burning-man" },
  owners: DEFAULT_OWNERS,
});
