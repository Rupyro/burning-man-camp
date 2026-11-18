// Camp-specific text for "Ask the guide". Leads edit this file; the search code stays generic.

import type { SearchEntry } from "@/lib/keyword-search";
import { CAMP_GUIDE } from "./camp-info";

const from = (topic: string, prefix: string, lines: readonly string[], keywords: string[]) =>
  lines.map((text, i) => ({ id: `${prefix}-${i + 1}`, topic, text, keywords }));

export const GUIDE_ENTRIES: SearchEntry[] = [
  ...from("Member guide", "guide", CAMP_GUIDE.guide, ["help", "tasks", "lead"]),
  ...from("What to bring", "bring", CAMP_GUIDE.packing, ["pack", "packing", "kit", "gear"]),
  ...from("Camp rules", "rules", CAMP_GUIDE.rules, ["rule", "moop", "behaviour"]),
  {
    id: "food-1",
    topic: "Food",
    text: "Camp meals and the kitchen plan are TBC. Everyone helps on kitchen shifts.",
    keywords: ["meals", "kitchen", "eat", "cooking", "dinner", "breakfast"],
  },
  {
    id: "food-2",
    topic: "Food",
    text: "Bring your own snacks for the drive in. Tell your lead about any dietary needs on your profile.",
    keywords: ["snacks", "diet", "allergies", "vegetarian"],
  },
  {
    id: "fees-1",
    topic: "Fees",
    text: "The camp fee amount and due date are TBC. The leads will confirm them.",
    keywords: ["fee", "cost", "price", "pay", "payment", "money", "dues"],
  },
  {
    id: "fees-2",
    topic: "Fees",
    text: "How to pay (and any deposit) is TBC. Your to-do list will show it once it's set.",
    keywords: ["deposit", "pay", "payment", "bank"],
  },
];

export const GUIDE_EXAMPLES = ["What should I bring?", "Food", "Camp fee", "Rules"];
