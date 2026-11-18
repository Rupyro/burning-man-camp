// The daily digest: after 07:00 camp time, each person's undigested "digest" notifications go
// into one queued email (spec N4). The dedupe key allows one digest per person per camp day.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { instantToCampInput } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import type { DbOrTx } from "../db/client";
import { notifications, people } from "../schema";
import { enqueueEmail } from "./notify";
import { buildDigest, DIGEST_HOUR_LOCAL } from "./rules/digest";

export async function runDigest(db: DbOrTx, now: Date) {
  const { date: day, time } = instantToCampInput(now);
  if (Number(time.slice(0, 2)) < DIGEST_HOUR_LOCAL) return { people: 0, notifications: 0 };
  const rows = await db
    .select({
      id: notifications.id,
      personId: notifications.recipientPersonId,
      email: people.email,
      type: notifications.type,
      title: notifications.title,
      href: notifications.href,
    })
    .from(notifications)
    .innerJoin(people, eq(people.id, notifications.recipientPersonId))
    .where(and(eq(notifications.urgency, "digest"), isNull(notifications.digestedAt)))
    .orderBy(asc(notifications.createdAt), asc(notifications.id));
  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) byPerson.set(r.personId, [...(byPerson.get(r.personId) ?? []), r]);
  let sentTo = 0;
  let included = 0;
  for (const [personId, items] of byPerson) {
    const first = items[0];
    if (!first) continue;
    const { queued } = await enqueueEmail(db, {
      toPersonId: personId,
      toEmail: first.email,
      template: "digest",
      payload: { ...buildDigest(items, getEnv().BETTER_AUTH_URL) },
      dedupeKey: `digest:${personId}:${day}`,
    });
    if (!queued) continue; // today's digest already went; these wait for tomorrow's
    await db
      .update(notifications)
      .set({ digestedAt: now })
      .where(
        inArray(
          notifications.id,
          items.map((i) => i.id),
        ),
      );
    sentTo++;
    included += items.length;
  }
  return { people: sentTo, notifications: included };
}
