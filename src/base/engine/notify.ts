// In-app notifications, per-person preferences, and queuing emails in the outbox
// (spec N1–N3, DATA_MODEL.md §12). Sending happens in the outbox job, never inline.
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { firstRow } from "@/lib/rows";
import type { DbOrTx } from "../db/client";
import { ForbiddenError } from "../errors";
import { isInBurnMode } from "../people/burn-mode";
import { burnSilences } from "../people/burn-rules";
import {
  emailOutbox,
  notificationChannelEnum,
  notificationPreferences,
  notifications,
  people,
} from "../schema";
import { BASE_NOTIFICATION_TYPES, type Channel, channelFor } from "./rules/channels";
import { type EngineCtx, nowOf, parse } from "./shared";

export interface Notice {
  recipientPersonId: string;
  /** e.g. task.assigned; modules use "<module>.<type>". */
  type: string;
  entityType: string;
  entityId: string;
  /** Built from safe fields only (task titles, never contact or health details). */
  title: string;
  href: string;
  body?: string;
  alertStateId?: string;
  /** Automation reminders: never an immediate email, only the daily digest (or off). */
  digestOnly?: boolean;
  /** The caller's clock (defaults to the database's), so time rules read the same clock. */
  createdAt?: Date;
}

export interface OutboxEmail {
  toPersonId: string | null;
  toEmail: string;
  template: string;
  payload: { subject: string; text: string; link?: string };
  dedupeKey: string;
}

/** Queue an email once per dedupe key. */
export async function enqueueEmail(db: DbOrTx, email: OutboxEmail) {
  const rows = await db
    .insert(emailOutbox)
    .values(email)
    .onConflictDoNothing({ target: emailOutbox.dedupeKey })
    .returning({ id: emailOutbox.id });
  return { queued: rows.length > 0 };
}

async function prefsOf(db: DbOrTx, personId: string) {
  return db
    .select({ type: notificationPreferences.type, channel: notificationPreferences.channel })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.personId, personId));
}

/**
 * Record a notification for one person, following their preference: off → nothing;
 * email_immediate → also queue an email; email_digest → picked up by the daily digest.
 * Someone in Burn Mode gets none of the pre-Burn noise (burn-rules.ts).
 */
export async function notify(
  db: DbOrTx,
  { digestOnly, ...n }: Notice,
): Promise<{ id: string } | null> {
  const chosen = channelFor(n.type, await prefsOf(db, n.recipientPersonId));
  if (chosen === "off") return null;
  // Burn Mode: nudges, task alerts and Money notices stay quiet for this person (no row at all).
  if (burnSilences(n) && (await isInBurnMode(db, n.recipientPersonId))) return null;
  const channel = digestOnly && chosen === "email_immediate" ? "email_digest" : chosen;
  const row = firstRow(
    await db
      .insert(notifications)
      .values({ ...n, urgency: channel === "email_digest" ? "digest" : "immediate" })
      .returning({ id: notifications.id }),
    "notification",
  );
  if (channel === "email_immediate") {
    const [to] = await db
      .select({ email: people.email })
      .from(people)
      .where(eq(people.id, n.recipientPersonId));
    if (to) {
      const link = `${getEnv().BETTER_AUTH_URL}${n.href}`;
      await enqueueEmail(db, {
        toPersonId: n.recipientPersonId,
        toEmail: to.email,
        template: "notification",
        payload: { subject: n.title, text: `${n.title}\n\n${n.body ?? ""}\n\nOpen: ${link}`, link },
        dedupeKey: `notification:${row.id}`,
      });
    }
  }
  return row;
}

function me(ctx: EngineCtx) {
  if (!ctx.actor.personId) throw new ForbiddenError();
  return ctx.actor.personId;
}

/** Spec N1 / S4. Only ever the caller's own notifications, newest first. */
export async function listMyNotifications(ctx: EngineCtx, limit = 50) {
  return ctx.db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      urgency: notifications.urgency,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.recipientPersonId, me(ctx)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

export async function unreadCount(ctx: EngineCtx) {
  const [r] = await ctx.db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientPersonId, me(ctx)), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

/** Someone else's id simply matches nothing. */
export async function markRead(ctx: EngineCtx, notificationId: string) {
  const rows = await ctx.db
    .update(notifications)
    .set({ readAt: nowOf(ctx) })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientPersonId, me(ctx)),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  return { changed: rows.length > 0 };
}

export async function markAllRead(ctx: EngineCtx) {
  await ctx.db
    .update(notifications)
    .set({ readAt: nowOf(ctx) })
    .where(and(eq(notifications.recipientPersonId, me(ctx)), isNull(notifications.readAt)));
  return { ok: true };
}

/** The caller's effective channel for each base type, plus their '*' choice if set. */
export async function getMyPreferences(ctx: EngineCtx) {
  const prefs = await prefsOf(ctx.db, me(ctx));
  return BASE_NOTIFICATION_TYPES.map((type) => ({
    type,
    channel: channelFor(type, prefs),
    custom: prefs.some((p) => p.type === type),
  }));
}

const prefInput = z.strictObject({
  type: z
    .string()
    .regex(/^(\*|[a-z][a-z_]*(\.[a-z_]+)+)$/, "Not a notification type")
    .max(40),
  channel: z.enum(notificationChannelEnum.enumValues),
});

export async function setMyPreference(ctx: EngineCtx, type: string, channel: Channel) {
  const input = parse(prefInput, { type, channel });
  await ctx.db
    .insert(notificationPreferences)
    .values({ personId: me(ctx), ...input, updatedAt: nowOf(ctx) })
    .onConflictDoUpdate({
      target: [notificationPreferences.personId, notificationPreferences.type],
      set: { channel: input.channel, updatedAt: nowOf(ctx) },
    });
  return { ok: true };
}
