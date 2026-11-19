// The app's way in to camp.config.ts: import camp settings from here, not from the root file.
import config from "../../camp.config";
import { campConfigProblems, type OwnerKey } from "./camp-config";

export type { OwnerKey };

export const campConfig = config;
/** The camp's display name, e.g. "Oe-aa-sies". */
export const CAMP_NAME = config.camp.name;
/** Money symbol before amounts, e.g. "R". */
export const MONEY_SYMBOL = config.money.symbol;
/** What to call the money in labels, e.g. "About how much? (dollars)". */
export const MONEY_UNIT =
  ({ ZAR: "rand", USD: "dollars" } as Record<string, string>)[config.money.currency] ??
  config.money.currency;
/** Number format for amounts: "en-US" for dollars, "en-ZA" for rand. */
export const MONEY_LOCALE = (config.money.currency as string) === "ZAR" ? "en-ZA" : "en-US";

/** Whether a camp tradition is switched on (camp.config.ts extras.traditions). */
export function hasTradition(key: string): boolean {
  return (config.extras.traditions as readonly string[]).includes(key);
}

// A broken camp.config.ts should stop the build with plain words, not half-work at runtime.
const problems = campConfigProblems(config);
if (problems.length) throw new Error(`camp.config.ts needs fixing:\n- ${problems.join("\n- ")}`);

/** Display name for a stored gear-owner key, e.g. "Ours" for ours. */
export function ownerLabel(key: string): string {
  return campConfig.owners.labels[key as OwnerKey] ?? key;
}
