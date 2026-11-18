import "server-only";
// AI writer for drafts: the Vercel AI SDK through AI Gateway, the same small model as "Ask the
// camp". Only used when AI_GATEWAY_API_KEY is set and the monthly limit has room. If the AI call
// fails or comes back empty, the demo template is used instead.
import { generateText } from "ai";
import { CAMP_NAME } from "@/lib/camp";
import { getEnv } from "@/lib/env";
import { type DraftInput, type DraftWriter, writeDemo } from "../rules/draft-writer";

export function draftPrompt(input: DraftInput) {
  const what =
    input.kind === "email"
      ? "a short, polite email to a supplier. First line: Subject: <subject>. Then the email."
      : "a short, friendly WhatsApp message to the camp group, no subject.";
  return [
    `You write for ${CAMP_NAME}, a camp of about 100 people at AfrikaBurn. Write ${what}`,
    `It goes to: ${input.to}. Sign it from ${input.senderName}, ${input.teamName} team.`,
    "Plain words, no made-up facts, prices or dates.",
    `What to say: ${input.ask}`,
  ].join("\n");
}

export function parseDraft(raw: string, input: DraftInput) {
  const text = raw.trim();
  if (!text) return null;
  if (input.kind === "whatsapp") return { subject: null, body: text, writer: "ai" as const };
  const m = /^subject:\s*(.+)\n+([\s\S]+)$/i.exec(text);
  if (!m?.[1] || !m[2]) return null;
  return { subject: m[1].trim().slice(0, 200), body: m[2].trim(), writer: "ai" as const };
}

export const aiWriter: DraftWriter = {
  kind: "ai",
  async write(input) {
    try {
      const { text } = await generateText({
        model: getEnv().ASK_AI_MODEL,
        prompt: draftPrompt(input),
        maxOutputTokens: 600,
      });
      return parseDraft(text, input) ?? writeDemo(input);
    } catch (error) {
      console.warn("[drafts] AI writer failed, using the demo template", error);
      return writeDemo(input);
    }
  },
};
