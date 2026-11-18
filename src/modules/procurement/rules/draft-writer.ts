// Drafts (Oct 28 2026): a lead asks for a vendor email or a WhatsApp update and the app writes a
// draft they can edit. The writer sits behind this interface like the "Ask the camp" router, so
// the demo version (fixed templates, no AI) and the AI version can be swapped.
import { CAMP_NAME } from "@/lib/camp";

export type DraftKind = "email" | "whatsapp";

export interface DraftInput {
  kind: DraftKind;
  /** What the lead wants to say, in their own words. */
  ask: string;
  /** Email address or a WhatsApp group/person name. */
  to: string;
  senderName: string;
  teamName: string;
}

export interface Draft {
  subject: string | null;
  body: string;
  writer: "demo" | "ai";
}

export interface DraftWriter {
  readonly kind: "demo" | "ai";
  write(input: DraftInput): Promise<Draft>;
}

/** A cautious per-draft estimate in cents (drafts are longer than asks). */
export const AI_COST_CENTS_PER_DRAFT = 3;

const clean = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function writeDemo(input: DraftInput): Draft {
  const ask = clean(input.ask);
  if (input.kind === "whatsapp")
    return {
      subject: null,
      body: `Hi everyone! ${capital(ask)}. Thank you! 🙏\n– ${input.senderName} (${input.teamName})`,
      writer: "demo",
    };
  const subject = `Request from ${CAMP_NAME}: ${ask}`;
  return {
    subject: subject.length > 80 ? `${subject.slice(0, 77)}...` : subject,
    body: [
      "Hi there,",
      "",
      `We're a camp of about 100 people at AfrikaBurn. Could you please help us with ${ask}?`,
      "",
      "Please let us know if you need anything else from us.",
      "",
      "Thank you,",
      `${input.senderName}, ${CAMP_NAME} ${input.teamName}`,
    ].join("\n"),
    writer: "demo",
  };
}

export const demoWriter: DraftWriter = { kind: "demo", write: async (i) => writeDemo(i) };

/** WhatsApp is never sent by the app: this link only opens WhatsApp with the text ready. */
export function whatsappLink(body: string) {
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}
