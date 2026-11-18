// pnpm camp:setup — 7 questions that write camp.config.ts for a new camp (plan PR 16).
// Run it once after copying the repo; nothing is written until you confirm in step 7.
// Then swap camp-art/ and camp-content/, run `pnpm format`, and commit.
import { writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import current from "../camp.config";
import {
  CAMP_TYPES,
  type CampPackKey,
  type CampTypeKey,
  campConfigProblems,
} from "../src/lib/camp-config";
import {
  configFrom,
  feeCents,
  PICKABLE_PACKS,
  renderCampConfig,
  SETUP_STEPS,
  TRADITIONS,
} from "./lib/camp-setup";

const rl = createInterface({ input: stdin, terminal: false });
// One line per answer; works typed or piped (e.g. answers from a file).
const lines = rl[Symbol.asyncIterator]();
const step = (n: number) => console.log(`\nStep ${n} of 7: ${SETUP_STEPS[n - 1]}`);
const ask = async (q: string, d: string) => {
  stdout.write(`${q} [${d}]: `);
  const r = await lines.next();
  return (r.done ? "" : String(r.value)).trim() || d;
};
const yes = async (q: string, d: boolean) => /^y/i.test(await ask(`${q} (y/n)`, d ? "y" : "n"));

step(1);
const name = await ask("What's your camp called?", current.camp.name);
step(2);
const tagline = await ask(
  "One line about the app",
  `Operations platform for the ${name} camp at AfrikaBurn`,
);
step(3);
console.log("Camp types:");
for (const [i, t] of CAMP_TYPES.entries()) console.log(`  ${i + 1}. ${t.label}`);
const typeAnswer = await ask(
  "What kind of camp is it? (number)",
  String(CAMP_TYPES.findIndex((t) => t.key === (current.camp as { type?: string }).type) + 1 || 1),
);
const campType: CampTypeKey = CAMP_TYPES[Number(typeAnswer) - 1]?.key ?? "theme";
const sizeAnswer = Number(
  await ask("About how many people?", String((current.camp as { size?: number }).size ?? 25)),
);
const size = Number.isInteger(sizeAnswer) && sizeAnswer > 0 ? sizeAnswer : undefined;
console.log("Core is always on: kitchen, shade, build/strike, MOOP/LNT, money, joining.");
const packs: CampPackKey[] = [];
for (const p of PICKABLE_PACKS)
  if (await yes(`  ${p.label}?`, (current.camp.packs as readonly string[]).includes(p.key)))
    packs.push(p.key);
const ownCategories = (await ask("Your own gear categories, comma-separated (optional)", "none"))
  .split(",")
  .filter((x) => x.trim() && x.trim() !== "none");
step(4);
const currency = await ask("Currency code", current.money.currency);
const symbol = await ask("Money symbol", current.money.symbol);
let campFee: number | null = null;
while (campFee === null) {
  campFee = feeCents(await ask("Camp fee", String(current.money.campFeeCents / 100)));
  if (campFee === null) console.log("  Use a plain amount like 3500.");
}
step(5);
const familyYears = await yes(
  "Fast track for returning members (Family years)?",
  current.joining.familyYears.enabled,
);
const since = Number(
  await ask("Your camp's first year", String(current.joining.familyYears.since)),
);
step(6);
const traditions: string[] = [];
for (const t of TRADITIONS)
  if (await yes(`  ${t.label}?`, (current.extras.traditions as readonly string[]).includes(t.key)))
    traditions.push(t.key);
step(7);
const config = configFrom({
  name,
  tagline,
  packs,
  campType,
  ...(size ? { size } : {}),
  currency,
  symbol,
  campFee,
  familyYears,
  since,
  traditions,
  ownCategories,
});
const problems = campConfigProblems(config);
console.log(renderCampConfig(config));
if (problems.length) {
  console.log(`Not saved. Fix these and run again:\n- ${problems.join("\n- ")}`);
} else if (await yes("Save this as camp.config.ts?", false)) {
  writeFileSync("camp.config.ts", renderCampConfig(config));
  console.log("Saved. Next: swap camp-art/ and camp-content/, run pnpm format, and commit.");
} else console.log("Not saved.");
rl.close();
