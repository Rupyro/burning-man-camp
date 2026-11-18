// Deliver queued emails through the configured adapter (console in dev, memory in tests), within
// the daily cap (spec N3, DATA_MODEL.md §12 email_outbox). Never called inline from a request.
import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import type { DbOrTx } from "../db/client";
import { type EmailAdapter, getEmailAdapter } from "../email/adapter";
import { emailOutbox } from "../schema";

export const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5 * 60_000;

/** The cap counts sends per UTC day (how email providers count their free quota). */
const utcDayStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export async function sendPendingEmails(
  db: DbOrTx,
  now: Date,
  opts: { cap?: number; adapter?: EmailAdapter } = {},
) {
  const cap = opts.cap ?? getEnv().EMAIL_DAILY_CAP;
  const adapter = opts.adapter ?? getEmailAdapter();
  const [today] = await db
    .select({ n: count() })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "sent"), gte(emailOutbox.sentAt, utcDayStart(now))));
  const room = Math.max(0, cap - (today?.n ?? 0));
  const due = and(eq(emailOutbox.status, "pending"), lte(emailOutbox.nextAttemptAt, now));
  const batch =
    room === 0
      ? []
      : await db
          .select()
          .from(emailOutbox)
          .where(due)
          .orderBy(sql`(${emailOutbox.template} = 'digest')`, asc(emailOutbox.createdAt))
          .limit(room);
  let sent = 0;
  let failed = 0;
  for (const row of batch) {
    const [claimed] = await db
      .update(emailOutbox)
      .set({ status: "sending", attempts: row.attempts + 1 })
      .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "pending")))
      .returning({ attempts: emailOutbox.attempts });
    if (!claimed) continue;
    const payload = row.payload as { subject: string; text: string; link?: string };
    try {
      await adapter.send({ to: row.toEmail, tag: row.template, ...payload });
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: now, lastError: null })
        .where(eq(emailOutbox.id, row.id));
      sent++;
    } catch (error) {
      failed++;
      const giveUp = claimed.attempts >= MAX_ATTEMPTS;
      await db
        .update(emailOutbox)
        .set({
          status: giveUp ? "failed" : "pending",
          nextAttemptAt: new Date(now.getTime() + RETRY_BASE_MS * 2 ** (claimed.attempts - 1)),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 200),
        })
        .where(eq(emailOutbox.id, row.id));
    }
  }
  const [left] = await db.select({ n: count() }).from(emailOutbox).where(due);
  return { sent, failed, deferred: Math.max(0, (left?.n ?? 0) - failed) };
}
