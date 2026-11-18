import { describe, expect, it } from "vitest";
import { keywordSearch, tokens } from "./keyword-search";

const DOCS = [
  { id: "a", topic: "Packing", text: "Bring water and goggles", keywords: ["dust"] },
  { id: "b", topic: "Food", text: "Kitchen shifts and shared dinners" },
  { id: "c", topic: "Fees", text: "Camp fee amount is TBC" },
];

describe("keyword search", () => {
  it("splits a question into lower-case words and drops filler words", () => {
    expect(tokens("What should I BRING?")).toEqual(["bring"]);
  });
  it("finds entries by words in the text, topic or keywords", () => {
    expect(keywordSearch(DOCS, "water").map((r) => r.id)).toEqual(["a"]);
    expect(keywordSearch(DOCS, "food").map((r) => r.id)).toEqual(["b"]);
    expect(keywordSearch(DOCS, "dust").map((r) => r.id)).toEqual(["a"]);
  });
  it("matches word starts, so 'dinner' finds 'dinners'", () => {
    expect(keywordSearch(DOCS, "dinner").map((r) => r.id)).toEqual(["b"]);
  });
  it("ranks entries matching more words first", () => {
    const r = keywordSearch(DOCS, "camp fee kitchen");
    expect(r.map((x) => x.id)).toEqual(["c", "b"]);
  });
  it("returns nothing for an empty or filler-only question", () => {
    expect(keywordSearch(DOCS, "")).toEqual([]);
    expect(keywordSearch(DOCS, "what is the")).toEqual([]);
  });
});
