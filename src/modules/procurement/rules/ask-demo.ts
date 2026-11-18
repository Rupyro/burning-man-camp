// Demo router for "Ask the camp": keyword and date matching only, no AI and no cost.
// It is labelled "demo" everywhere the lead can see it.
import type { AskInput, AskRoute, AskRouter } from "./ask-router";

const TEAM_WORDS: Record<string, readonly string[]> = {
  kitchen: [
    "ice",
    "food",
    "cook",
    "kitchen",
    "meal",
    "breakfast",
    "dinner",
    "lunch",
    "gas bottle",
    "coffee",
    "milk",
    "bread",
    "vegetables",
    "veg",
    "spices",
    "pots",
    "fridge",
    "braai",
  ],
  logistics: [
    "truck",
    "trailer",
    "container",
    "transport",
    "lift",
    "drive",
    "pickup",
    "pick up",
    "load",
    "loading",
    "fuel",
    "diesel",
    "petrol",
    "bakkie",
    "delivery",
    "yard",
  ],
  camp_infra: [
    "shade",
    "tent",
    "dome",
    "generator",
    "power",
    "cable",
    "water tank",
    "shower",
    "toilet",
    "build",
    "scaffold",
    "rebar",
    "solar",
    "lights",
    "structure",
  ],
  gift_projects: ["art", "art car", "gift", "sculpture", "installation", "paint"],
  finance: ["fee", "fees", "invoice", "refund", "budget", "payment", "pay back", "receipt"],
  programming: ["workshop", "party", "dj", "music", "event", "schedule", "sound system"],
  community: ["new member", "members", "welcome", "application", "volunteer", "buddy"],
  duties: ["shift", "shifts", "roster", "cleaning", "duty", "duties"],
  moop: ["moop", "litter", "rubbish", "trash", "leave no trace", "sweep"],
  marketing: ["poster", "instagram", "social media", "flyer", "announcement", "press"],
  content: ["photo", "photos", "video", "film", "camera", "drone"],
  knowledge: ["guide", "document", "docs", "manual", "write up", "handbook", "wiki"],
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const BUY_START = /^(?:please\s+)?(?:we\s+)?(?:need|buy|get|order|grab|source)\b/i;
const QTY =
  /(\d+(?:[.,]\d+)?)\s*(kg|g|l|litres?|liters?|m|metres?|bags?|boxes?|packs?|rolls?|bottles?|x)?\s+(?:of\s+)?([a-z][a-z -]*?)(?=\s+(?:by|for|before|on|from|at|to)\b|[.,!]|$)/i;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fromIso = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => iso(new Date(fromIso(s).getTime() + n * 86_400_000));

/** The first date the request names, as YYYY-MM-DD (always today or later). */
export function parseDueDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  const isoHit = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoHit?.[1]) return isoHit[1];
  if (/\btoday\b|\btonight\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  const inDays = t.match(/\bin (\d{1,2}) days?\b/);
  if (inDays?.[1]) return addDays(today, Number(inDays[1]));
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  const dm = t.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\b/);
  const md = t.match(/\b([a-z]{3})[a-z]*\s+(\d{1,2})\b/);
  const pick =
    dm && MONTHS.includes(dm[2] ?? "")
      ? { day: Number(dm[1]), mon: MONTHS.indexOf(dm[2] ?? "") }
      : md && MONTHS.includes(md[1] ?? "")
        ? { day: Number(md[2]), mon: MONTHS.indexOf(md[1] ?? "") }
        : null;
  if (pick && pick.day >= 1 && pick.day <= 31) {
    const year = Number(today.slice(0, 4));
    let d = new Date(Date.UTC(year, pick.mon, pick.day));
    if (iso(d) < today) d = new Date(Date.UTC(year + 1, pick.mon, pick.day));
    return iso(d);
  }
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(t));
  if (wd >= 0) {
    const now = fromIso(today).getUTCDay();
    const ahead = (wd - now + 7) % 7 || 7;
    return addDays(today, ahead);
  }
  return null;
}

/** What to buy, when the request reads like a shopping ask ("need 20 kg of ice by Tuesday"). */
export function parseBuy(text: string): AskRoute["buy"] {
  const clean = text.trim();
  const m = clean.match(QTY);
  if (m?.[3]) {
    const unit = m[2] ? m[2].toLowerCase() : null;
    return {
      item: m[3].trim().toLowerCase(),
      quantity: Number((m[1] ?? "").replace(",", ".")),
      unit: unit === "x" ? null : unit,
    };
  }
  if (BUY_START.test(clean)) {
    const rest = clean
      .replace(BUY_START, "")
      .replace(/\s+(?:by|for|before|on)\b.*$/i, "")
      .replace(/^\s*(?:some|more|a|an)\s+/i, "")
      .trim()
      .toLowerCase();
    return rest ? { item: rest, quantity: null, unit: null } : null;
  }
  return null;
}

function scoreTeams(text: string, keys: readonly string[]) {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, " ")} `;
  return keys
    .map((key) => ({
      key,
      score: (TEAM_WORDS[key] ?? []).reduce(
        (n, w) => (t.includes(` ${w} `) || t.includes(` ${w}s `) ? n + w.split(" ").length : n),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

function titleOf(text: string, buy: AskRoute["buy"]) {
  if (buy) {
    const amount = [buy.quantity, buy.unit].filter((x) => x !== null).join(" ");
    return `Buy ${amount ? `${amount} ` : ""}${buy.item}`.slice(0, 200);
  }
  const s = text.trim().replace(/\s+/g, " ");
  return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 200);
}

export function routeDemo(input: AskInput): AskRoute {
  const keys = input.teams.map((t) => t.key);
  const best = scoreTeams(input.text, keys)[0];
  const buy = parseBuy(input.text);
  const guessed = !best || best.score === 0;
  return {
    teamKey: guessed ? (keys[0] ?? "") : best.key,
    title: titleOf(input.text, buy),
    dueOn: parseDueDate(input.text, input.today),
    buy,
    router: "demo",
    guessed,
  };
}

export const demoRouter: AskRouter = {
  kind: "demo",
  route: async (input) => routeDemo(input),
};
