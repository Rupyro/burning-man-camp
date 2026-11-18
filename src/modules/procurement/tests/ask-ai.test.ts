// "Ask the camp": when the AI router may run, and how its answer is checked.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ ASK_AI_MODEL: "openai/gpt-5-nano" }) }));

import { generateText } from "ai";
import { AI_COST_CENTS_PER_ASK, aiRouterAllowed } from "../rules/ask-pick";
import { aiRouter, askPrompt, parseAiAnswer } from "../server/ask-ai";

const input = {
  text: "need 20 kg of ice by Tuesday",
  today: "2026-04-09",
  teams: [
    { key: "kitchen", name: "Kitchen" },
    { key: "logistics", name: "Logistics" },
  ],
};

describe("ask the camp: AI only with a key and room under the monthly limit", () => {
  it.each([
    [{ hasKey: false, capCents: 15_000, spentCents: 0 }, false],
    [{ hasKey: true, capCents: 0, spentCents: 0 }, false],
    [{ hasKey: true, capCents: 15_000, spentCents: 15_000 }, false],
    [{ hasKey: true, capCents: 15_000, spentCents: 15_000 - AI_COST_CENTS_PER_ASK }, true],
    [{ hasKey: true, capCents: 15_000, spentCents: 0 }, true],
  ])("%o -> %s", (opts, want) => {
    expect(aiRouterAllowed(opts)).toBe(want);
  });
});

describe("ask the camp: AI answers", () => {
  it("reads a good answer and labels it as AI", () => {
    const r = parseAiAnswer(
      'Sure: {"team":"kitchen","title":"Buy 20 kg ice","dueOn":"2026-04-14","buy":{"item":"ice","quantity":20,"unit":"kg"}}',
      input,
    );
    expect(r).toEqual({
      teamKey: "kitchen",
      title: "Buy 20 kg ice",
      dueOn: "2026-04-14",
      buy: { item: "ice", quantity: 20, unit: "kg" },
      router: "ai",
      guessed: false,
    });
  });
  it.each([
    ["not json"],
    ['{"team":"moop","title":"x","dueOn":null,"buy":null}'],
    ['{"team":"kitchen","title":"","dueOn":null,"buy":null}'],
    ['{"team":"kitchen","title":"x","dueOn":"Tuesday","buy":null}'],
  ])("rejects a bad or out-of-list answer: %s", (raw) => {
    expect(parseAiAnswer(raw, input)).toBeNull();
  });
  it("tells the model the teams, today's date and past corrections", () => {
    const p = askPrompt(input, [{ text: "need braai wood", team: "kitchen" }]);
    expect(p).toContain("- kitchen: Kitchen");
    expect(p).toContain("Today is 2026-04-09");
    expect(p).toContain('"need braai wood" -> kitchen');
    expect(askPrompt(input, [])).not.toContain("corrected");
  });
});

describe("ask the camp: the AI router itself", () => {
  const mocked = vi.mocked(generateText);
  it("uses the AI's answer when it's good", async () => {
    mocked.mockResolvedValueOnce({
      text: '{"team":"logistics","title":"Fetch ice","dueOn":null,"buy":null}',
    } as Awaited<ReturnType<typeof generateText>>);
    const r = await aiRouter([]).route(input);
    expect(r).toMatchObject({ teamKey: "logistics", router: "ai" });
    expect(mocked.mock.calls[0]?.[0]).toMatchObject({ model: "openai/gpt-5-nano" });
  });
  it("falls back to the demo router on a bad answer or an error", async () => {
    mocked.mockResolvedValueOnce({ text: "no idea" } as Awaited<ReturnType<typeof generateText>>);
    expect(await aiRouter([]).route(input)).toMatchObject({ teamKey: "kitchen", router: "demo" });
    mocked.mockRejectedValueOnce(new Error("402 no credit"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await aiRouter([]).route(input)).toMatchObject({ teamKey: "kitchen", router: "demo" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
