import Link from "next/link";
import { listMyNotifications } from "@/base/engine/notify";
import { formatCampTime } from "@/lib/dates";
import { basePage } from "../_components/base-page";
import { MarkAllReadButton, MarkReadButton } from "../tasks/task-buttons";

const open =
  "inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground";

/**
 * Alerts (spec B3.2): things waiting for you, each with a button to where you deal with it.
 * Seen ones fold away below. How you hear about them is set once, in My profile.
 */
export default async function NotificationsPage() {
  const { items } = await basePage(async (ctx) => ({ items: await listMyNotifications(ctx) }));
  const waiting = items.filter((n) => !n.readAt);
  const seen = items.filter((n) => n.readAt);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="heading text-lg">Alerts</h1>
        <p className="text-sm">
          Things waiting for you. Tap <b>Open</b> to deal with one, then <b>Mark done</b>.
        </p>
      </header>
      <section aria-labelledby="waiting" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="waiting" className="heading text-sm">
            Waiting for you ({waiting.length})
          </h2>
          {waiting.length > 1 ? <MarkAllReadButton /> : null}
        </div>
        {waiting.length === 0 ? (
          <p className="rounded-2xl border bg-card p-4 text-sm">
            You're all caught up. Nothing is waiting for you.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((n) => (
              <li key={n.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div>
                  <p className="font-semibold">{n.title}</p>
                  {n.body ? <p className="text-sm">{n.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatCampTime(n.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <Link href={n.href} className={open}>
                    Open
                  </Link>
                  <MarkReadButton id={n.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {seen.length ? (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Already done ({seen.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {seen.map((n) => (
              <li key={n.id} className="text-sm">
                <Link href={n.href} className="underline">
                  {n.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">{formatCampTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Choose how you hear about alerts (app, email, daily email) in{" "}
        <Link href="/me#alert-settings" className="underline">
          My profile
        </Link>
        .
      </p>
    </div>
  );
}
