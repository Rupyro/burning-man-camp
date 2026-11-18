import { getEnv } from "@/lib/env";
import { globalSingleton } from "@/lib/global-singleton";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Template-ish tag for filtering, e.g. "auth.magic_link" */
  tag: string;
  /** The primary link in the message, if any (handy for the dev console and tests). */
  link?: string;
}

export interface EmailAdapter {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

type Holder = { sent: EmailMessage[]; override?: EmailAdapter };
const holder: Holder = globalSingleton<Holder>("__campEmail", () => ({ sent: [] }));

/** Dev adapter: prints the email (and its link) to the server console. Nothing leaves the box. */
export const consoleAdapter: EmailAdapter = {
  name: "console",
  async send(m) {
    const line = "─".repeat(60);
    console.info(
      `\n${line}\n📧  [dev email] to: ${m.to}\n    subject: ${m.subject}\n${m.link ? `    link: ${m.link}\n` : ""}${line}\n${m.text}\n${line}\n`,
    );
  },
};

/** Test adapter: keeps messages in memory. */
export const memoryAdapter: EmailAdapter = {
  name: "memory",
  async send(m) {
    holder.sent.push(m);
  },
};

export function getEmailAdapter(): EmailAdapter {
  if (holder.override) return holder.override;
  // TODO(B2): "resend" adapter via the email_outbox, once the camp Resend account exists.
  return getEnv().EMAIL_ADAPTER === "memory" ? memoryAdapter : consoleAdapter;
}

export function sentEmails(): EmailMessage[] {
  return holder.sent;
}
export function clearSentEmails() {
  holder.sent.length = 0;
}
export function setEmailAdapter(adapter: EmailAdapter | undefined) {
  holder.override = adapter;
}
