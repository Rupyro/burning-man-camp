import Link from "next/link";
import { can } from "@/base/authz/permissions";
import { listAvailableWork } from "@/base/engine/claims";
import { listMyTasks } from "@/base/engine/tasks";
import { basePage } from "../_components/base-page";
import { ClaimButton } from "./task-buttons";
import { claimLabel, dueLabel, roomLabel, statusLabel } from "./task-view";

/** S1 My tasks: what I own or help on (overdue first), then open work I could claim. Plain markup. */
export default async function MyTasksPage() {
  const { mine, available } = await basePage(async (ctx) => ({
    mine: await listMyTasks(ctx),
    available: can(ctx.actor, "task.claim") ? await listAvailableWork(ctx) : [],
  }));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading text-lg">My tasks</h1>
      <section aria-labelledby="mine" className="flex flex-col gap-2">
        <h2 id="mine" className="heading text-sm">
          Mine ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on your list. Pick something below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((t) => (
              <li key={t.id} className="rounded-2xl border bg-card p-3">
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium underline [overflow-wrap:anywhere]"
                >
                  {t.title}
                </Link>
                <p className="text-sm">
                  {statusLabel(t.status)} · {dueLabel(t.dueAt, t.urgency)} · {t.projectName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="available" className="flex flex-col gap-2">
        <h2 id="available" className="heading text-sm">
          Open for helpers ({available.length})
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks need helpers right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 rounded-2xl border bg-card p-3">
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium underline [overflow-wrap:anywhere]"
                >
                  {t.title}
                </Link>
                <p className="text-sm">
                  {dueLabel(t.dueAt, "normal")} · {t.projectName} ·{" "}
                  {roomLabel(t.helpers, t.claimCapacity)}
                </p>
                <ClaimButton taskId={t.id} label={claimLabel(t.claimMode)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
