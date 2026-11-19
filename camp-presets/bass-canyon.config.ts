// Test camp preset: Bass Canyon, a 150-person placed sound camp (made-up camp, fake numbers).
// Try it: copy this file over camp.config.ts. The packs and type match the plan's example.
import { DEFAULT_OWNERS, defineCampConfig } from "../src/lib/camp-config";

export default defineCampConfig({
  camp: {
    name: "Bass Canyon",
    shortName: "Bass Canyon",
    slug: "basscanyon",
    tagline: "A placed sound camp at Burning Man",
    packs: ["core", "sound", "kitchen", "fire-flame", "workshops"],
    type: "theme",
    size: 150,
  },
  look: { logo: "/backdrop/logomark.png", emblem: "protea" },
  money: { currency: "USD", symbol: "$", campFeeCents: 65_000, xceed: { enabled: false } },
  joining: { familyYears: { enabled: true, since: 2019 } },
  extras: { traditions: [] },
  event: { pack: "burning-man" },
  owners: DEFAULT_OWNERS,
});
