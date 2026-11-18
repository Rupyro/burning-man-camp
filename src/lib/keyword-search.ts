// Plain keyword search (no AI, no network): score entries by how many question words they contain.

export interface SearchEntry {
  id: string;
  topic: string;
  text: string;
  keywords?: readonly string[];
}

const FILLER = new Set(
  "a an and are at be can do does for how i in is it me much my of on or should the to we what when where which who will with you your".split(
    " ",
  ),
);

/** Lower-case words of a question, without filler words. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));
}

/** Entries matching at least one question word (word-start match), best match first. */
export function keywordSearch<T extends SearchEntry>(entries: readonly T[], query: string): T[] {
  const words = [...new Set(tokens(query))];
  if (!words.length) return [];
  const scored: { entry: T; score: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const own = tokens([entry.topic, entry.text, ...(entry.keywords ?? [])].join(" "));
    const score = words.filter((w) => own.some((o) => o.startsWith(w))).length;
    if (score > 0) scored.push({ entry, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.entry);
}
