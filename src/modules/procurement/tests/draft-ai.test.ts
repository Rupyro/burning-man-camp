// Drafts: the AI writer's prompt, how its answer is read, and falling back to the template.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ ASK_AI_MODEL: "openai/gpt-5-nano" }) }));

import { generateText } from "ai";
import { writeDemo } from "../rules/draft-writer";
import { aiWriter, draftPrompt, parseDraft } from "../server/draft-ai";

const email = {
  kind: "email" as const,
  ask: "a quote for 200 kg of ice",
  to: "orders@tankwa-ice.example",
  senderName: "Lindiwe",
  teamName: "Kitchen",
};
const wa = { ...email, kind: "whatsapp" as const, to: "Camp group", ask: "loading at 10 am" };

describe("drafts: AI writer", () => {
  it("asks for a subject line on emails only, and no made-up facts", () => {
    expect(draftPrompt(email)).toContain("Subject:");
    expect(draftPrompt(wa)).not.toContain("Subject:");
    expect(draftPrompt(email)).toContain("no made-up facts");
  });

  it("reads the subject and body of an email, and a WhatsApp as is", () => {
    expect(parseDraft("Subject: Ice quote\n\nHi there, 200 kg please.", email)).toEqual({
      subject: "Ice quote",
      body: "Hi there, 200 kg please.",
      writer: "ai",
    });
    expect(parseDraft("Hi everyone!", wa)).toEqual({
      subject: null,
      body: "Hi everyone!",
      writer: "ai",
    });
    expect(parseDraft("no subject here", email)).toBeNull();
    expect(parseDraft("   ", wa)).toBeNull();
  });

  it("uses the AI text, and the template when the AI fails or answers badly", async () => {
    const gen = vi.mocked(generateText);
    gen.mockResolvedValueOnce({ text: "Subject: Ice\n\nHello" } as Awaited<
      ReturnType<typeof generateText>
    >);
    expect((await aiWriter.write(email)).writer).toBe("ai");
    gen.mockResolvedValueOnce({ text: "" } as Awaited<ReturnType<typeof generateText>>);
    expect(await aiWriter.write(email)).toEqual(writeDemo(email));
    gen.mockRejectedValueOnce(new Error("down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await aiWriter.write(wa)).toEqual(writeDemo(wa));
    expect(warn).toHaveBeenCalled();
  });
});
