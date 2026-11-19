// Drafts (Oct 28 2026): the demo writer's templates, the WhatsApp link, and the review rules.
import { describe, expect, it } from "vitest";
import { AI_COST_CENTS_PER_DRAFT, whatsappLink, writeDemo } from "../rules/draft-writer";
import { isStaleDraft, STALE_DRAFT_DAYS, spendLine, yesterdayOf } from "../rules/review";

const base = { to: "orders@tankwa-ice.example", senderName: "Lindiwe", teamName: "Kitchen" };

describe("demo draft writer", () => {
  it("writes a polite vendor email with a subject, signed by the lead", () => {
    const d = writeDemo({ ...base, kind: "email", ask: "a quote for 200 kg of ice on 27 April" });
    expect(d.writer).toBe("demo");
    expect(d.subject).toBe("Request from Your Camp: a quote for 200 kg of ice on 27 April");
    expect(d.body).toContain("Hi there,");
    expect(d.body).toContain(
      "Could you please help us with a quote for 200 kg of ice on 27 April?",
    );
    expect(d.body).toContain("Lindiwe, Your Camp Kitchen");
  });

  it("cuts a long subject and strips a trailing full stop", () => {
    const d = writeDemo({ ...base, kind: "email", ask: `${"x".repeat(100)}.` });
    expect(d.subject?.length).toBeLessThanOrEqual(80);
    expect(d.body).not.toContain("x.?");
  });

  it("writes a short WhatsApp update with no subject", () => {
    const d = writeDemo({
      ...base,
      kind: "whatsapp",
      to: "Your Camp Camp group",
      ask: "container loading now starts at 10 am, not 9 am",
    });
    expect(d.subject).toBeNull();
    expect(d.body).toBe(
      "Hi everyone! Container loading now starts at 10 am, not 9 am. Thank you! 🙏\n– Lindiwe (Kitchen)",
    );
  });

  it("makes a WhatsApp link that only opens WhatsApp with the text ready", () => {
    expect(whatsappLink("Hi & bye 🙏")).toBe(
      `https://wa.me/?text=${encodeURIComponent("Hi & bye 🙏")}`,
    );
    expect(AI_COST_CENTS_PER_DRAFT).toBeGreaterThan(0);
  });
});

describe("daily review rules", () => {
  const now = new Date("2026-04-10T17:00:00Z"); // 10:00 camp time

  it("yesterday runs midnight to midnight in camp time", () => {
    const y = yesterdayOf(now);
    expect(y.date).toBe("2026-04-09");
    expect(y.start.toISOString()).toBe("2026-04-09T07:00:00.000Z");
    expect(y.end.toISOString()).toBe("2026-04-10T07:00:00.000Z");
  });

  it("an unsent draft is flagged after two days, a sent or discarded one never", () => {
    const old = new Date(now.getTime() - STALE_DRAFT_DAYS * 86_400_000);
    const fresh = new Date(now.getTime() - 86_400_000);
    expect(isStaleDraft({ status: "draft", createdAt: old }, now)).toBe(true);
    expect(isStaleDraft({ status: "draft", createdAt: fresh }, now)).toBe(false);
    expect(isStaleDraft({ status: "sent", createdAt: old }, now)).toBe(false);
    expect(isStaleDraft({ status: "discarded", createdAt: old }, now)).toBe(false);
  });

  it("says the AI spend in dollars against the limit", () => {
    expect(spendLine(1_800, 15_000)).toBe(
      "This month the AI has cost $18, which is under the $150 limit.",
    );
    expect(spendLine(14_000, 15_000)).toBe(
      "This month the AI has cost $140, close to the $150 limit.",
    );
    expect(spendLine(15_000, 15_000)).toBe(
      "This month the AI has cost $150 and reached the $150 limit, so the demo version is used until next month.",
    );
    expect(spendLine(0, 0)).toBe(
      "The AI is off (the monthly limit is $0), so only the demo version runs.",
    );
  });
});
