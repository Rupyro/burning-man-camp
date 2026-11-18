import Link from "next/link";
import { can } from "@/base/authz/permissions";
import { listChecklist } from "@/base/engine/checklist";
import { listHelpers } from "@/base/engine/claims";
import { listComments, listWatchers } from "@/base/engine/comments";
import { listDependencies } from "@/base/engine/dependencies";
import { getTask, listProjectTasks } from "@/base/engine/tasks";
import { listDirectory } from "@/base/people/directory";
import { DetailLayout, DetailSection } from "@/components/ui/detail-layout";
import { formatCampTime, instantToCampInput } from "@/lib/dates";
import { basePage } from "../../_components/base-page";
import { ClaimButton } from "../task-buttons";
import { claimLabel, dueLabel, roomLabel, statusLabel } from "../task-view";
import * as C from "./task-controls";
import { canClaim, canTick, helperControls } from "./task-page-view";

/** S3 Task: reads like a page (DetailLayout): description, facts, checklist, waits-on, helpers and
 * comments; the update tools sit in the side column. */
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await basePage(async (ctx) => {
    const task = await getTask(ctx, id);
    const manage = task.can.manage && can(ctx.actor, "member.view_directory");
    return {
      task,
      me: ctx.actor.personId ?? undefined,
      deps: await listDependencies(ctx, id),
      helpers: await listHelpers(ctx, id),
      checklist: await listChecklist(ctx, id),
      comments: await listComments(ctx, id),
      watchers: await listWatchers(ctx, id),
      siblings: task.can.manage ? await listProjectTasks(ctx, task.projectId) : [],
      people: manage
        ? (await listDirectory(ctx)).map((p) => ({ value: p.personId, label: p.displayName }))
        : [],
    };
  });
  const { task: t, me } = d;
  const due = t.dueAt ? instantToCampInput(t.dueAt) : { date: "", time: "" };
  const tick = canTick(t.can.edit, d.helpers, me);
  const chip = "rounded-full px-2 py-0.5 text-xs font-semibold";
  return (
    <DetailLayout
      back={
        <Link href={`/projects/${t.project.id}`} className="underline">
          ← {t.project.name}
        </Link>
      }
      title={t.title ?? ""}
      badges={
        <>
          <span className={`${chip} border border-current`}>{statusLabel(t.status)}</span>
          {t.isCritical ? <span className={`${chip} bg-rust text-white`}>Critical</span> : null}
          {d.deps.atRisk ? (
            <span className={`${chip} bg-ochre text-earth`}>
              At risk (waiting on something late or blocked)
            </span>
          ) : null}
        </>
      }
      description={t.description ?? undefined}
      facts={[
        ["Due", dueLabel(t.dueAt, t.urgency)],
        ["Owner", t.ownerName ?? "No owner"],
        ["Project", t.project.name],
        ...(t.blockedReason ? [["Blocked", t.blockedReason] as [string, string]] : []),
        [
          "Helpers",
          roomLabel(d.helpers.filter((h) => h.status === "active").length, t.claimCapacity),
        ],
      ]}
      aside={
        <>
          <C.WatchButton taskId={t.id} watching={me !== undefined && d.watchers.includes(me)} />
          {t.can.edit ? (
            <DetailSection title="Update" boxed>
              <C.StatusForm taskId={t.id} status={t.status} reason={t.blockedReason ?? ""} />
              <C.DueForm taskId={t.id} date={due.date} time={due.time} />
              {t.can.manage ? (
                <C.OwnerForm taskId={t.id} owner={t.ownerPersonId ?? ""} people={d.people} />
              ) : null}
            </DetailSection>
          ) : null}
          {t.can.manage ? (
            <DetailSection title="Helper settings" boxed>
              <C.ClaimModeForm
                taskId={t.id}
                mode={t.claimMode}
                capacity={t.claimCapacity?.toString() ?? ""}
              />
              {d.people.length ? <C.AddHelperForm taskId={t.id} people={d.people} /> : null}
            </DetailSection>
          ) : null}
        </>
      }
    >
      <DetailSection title="Checklist">
        {d.checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist yet.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {d.checklist.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2">
              <span>
                {i.doneAt ? "☑" : "☐"} {i.label}
              </span>
              <C.ChecklistControls
                itemId={i.id}
                done={i.doneAt !== null}
                tick={tick}
                remove={t.can.edit}
              />
            </li>
          ))}
        </ul>
        {t.can.edit ? <C.ChecklistAddForm taskId={t.id} /> : null}
      </DetailSection>

      <DetailSection title="Waits on">
        {d.deps.prerequisites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing.</p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {d.deps.prerequisites.map((p) => (
            <li key={p.id}>
              <Link href={`/tasks/${p.id}`} className="underline">
                {p.title}
              </Link>{" "}
              · {statusLabel(p.status)}
              {t.can.manage ? <C.UnlinkButton taskId={t.id} dependsOnTaskId={p.id} /> : null}
            </li>
          ))}
        </ul>
        {d.deps.dependents.length ? (
          <p className="text-sm">
            Waiting on this: {d.deps.dependents.map((x) => x.title).join(", ")}
          </p>
        ) : null}
        {t.can.manage && d.siblings.length > 1 ? (
          <C.LinkForm
            taskId={t.id}
            tasks={d.siblings
              .filter((s) => s.id !== t.id)
              .map((s) => ({ value: s.id, label: s.title ?? "" }))}
          />
        ) : null}
      </DetailSection>

      <DetailSection title="Helpers">
        {d.helpers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No helpers yet.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {d.helpers.map((h) => (
            <li key={h.assignmentId} className="rounded-xl border p-3">
              {h.name} {h.status === "pending_approval" ? "(asked to help)" : ""}
              <C.HelperControls
                assignmentId={h.assignmentId}
                {...helperControls(h, me, t.can.manage)}
              />
            </li>
          ))}
        </ul>
        {canClaim(t, d.helpers, me) && t.can.claim ? (
          <ClaimButton taskId={t.id} label={claimLabel(t.claimMode)} />
        ) : null}
      </DetailSection>

      <DetailSection title="Comments" boxed>
        {d.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {d.comments.map((c) => (
            <li key={c.id} className="border-b pb-3 last:border-0">
              <p className="text-xs text-muted-foreground">
                {c.authorName} · {formatCampTime(c.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{c.body}</p>
              {c.authorPersonId === me || t.can.manage ? (
                <C.RemoveCommentButton commentId={c.id} />
              ) : null}
            </li>
          ))}
        </ul>
        {t.can.comment ? <C.CommentForm taskId={t.id} /> : null}
      </DetailSection>
    </DetailLayout>
  );
}
