import "server-only";
// AI router for "Ask the camp": the Vercel AI SDK through AI Gateway with a small model.
// Only used when AI_GATEWAY_API_KEY is set and the monthly limit has room (see rules/ask-pick).
// If the AI call fails or answers nonsense, the demo router's answer is used instead.
import { generateText } from "ai";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { routeDemo } from "../rules/ask-demo";
import type { AskInput, AskRoute, AskRouter } from "../rules/ask-router";

const answer = z.object({
  team: z.string(),
  title: z.string().min(1).max(200),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  buy: z
    .object({
      item: z.string().min(1).max(100),
      quantity: z.number().positive().nullable(),
      unit: z.string().max(20).nullable(),
    })
    .nullable(),
});

export function askPrompt(input: AskInput, examples: readonly { text: string; team: string }[]) {
  const teams = input.teams.map((t) => `- ${t.key}: ${t.name}`).join("\n");
  const fixes = examples.map((e) => `- "${e.text}" -> ${e.team}`).join("\n");
  return [
    "You file requests for a Burning Man style camp. Pick ONE team key from this list:",
    teams,
    fixes ? `Leads corrected these before; follow them:\n${fixes}` : "",
    `Today is ${input.today}. Answer with JSON only, no other text:`,
    '{"team": "<key>", "title": "<short task title>", "dueOn": "YYYY-MM-DD" or null,',
    ' "buy": {"item": "...", "quantity": number or null, "unit": "..." or null} or null}',
    "Set buy only when the request is something to buy or get.",
    `Request: ${input.text}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseAiAnswer(raw: string, input: AskInput): AskRoute | null {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = answer.safeParse(data);
  if (!parsed.success || !input.teams.some((t) => t.key === parsed.data.team)) return null;
  return {
    teamKey: parsed.data.team,
    title: parsed.data.title,
    dueOn: parsed.data.dueOn,
    buy: parsed.data.buy,
    router: "ai",
    guessed: false,
  };
}

export function aiRouter(examples: readonly { text: string; team: string }[]): AskRouter {
  return {
    kind: "ai",
    async route(input) {
      try {
        const { text } = await generateText({
          model: getEnv().ASK_AI_MODEL,
          prompt: askPrompt(input, examples),
          maxOutputTokens: 300,
        });
        return parseAiAnswer(text, input) ?? routeDemo(input);
      } catch (error) {
        console.warn("[ask-the-camp] AI router failed, using the demo router", error);
        return routeDemo(input);
      }
    },
  };
}
